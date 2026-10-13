import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  disciplina: z.string().min(1).max(200),
  assuntos: z.array(z.string().max(200)).max(10),
  banca: z.string().max(200),
  nivel: z.string().max(200),
  tipo: z.enum(["multipla_escolha", "certo_errado"]),
  quantidade: z.number().int().min(1).max(10),
  instrucoes: z.string().max(2000),
  conteudo: z.string().max(60000).default(""),
});

const Schema = z.object({
  questoes: z.array(z.object({
    enunciado: z.string(),
    alternativas: z.array(z.string()),
    correta: z.number().int(),
    comentario: z.string(),
  })),
});

export type QuestaoGerada = z.infer<typeof Schema>["questoes"][number];

export const gerarQuestoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ questoes: QuestaoGerada[]; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { questoes: [], error: "IA não configurada." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const ce = data.tipo === "certo_errado";
    const instructions = `Você é um elaborador experiente de questões de concursos públicos brasileiros. Escreva em português do Brasil, com rigor técnico e sem erros factuais.
${ce
  ? 'Formato CERTO/ERRADO (estilo Cebraspe): cada questão é um item para julgar. "alternativas" deve ser exatamente ["Certo","Errado"] e "correta" é 0 (Certo) ou 1 (Errado). Varie o gabarito.'
  : 'Formato MÚLTIPLA ESCOLHA: exatamente 5 alternativas (A a E), sem prefixo de letra, uma única correta; "correta" é o índice 0-4. Varie a posição da correta.'}
"comentario" explica por que a resposta está certa e as demais erradas.`;
    const prompt = `Gere ${data.quantidade} questão(ões) inéditas.
Disciplina: ${data.disciplina}
${data.assuntos.length ? `Assunto(s): ${data.assuntos.join(", ")}` : "Assunto livre: defina o tema a partir do conteúdo enviado e/ou das instruções adicionais."}
${data.banca ? `Estilo da banca: ${data.banca}` : ""}
${data.nivel ? `Escolaridade: ${data.nivel}` : ""}
${data.instrucoes ? `Instruções adicionais: ${data.instrucoes}` : ""}
${data.conteudo ? `\nBaseie as questões EXCLUSIVAMENTE no conteúdo abaixo (não invente fatos fora dele):\n"""\n${data.conteudo}\n"""` : ""}`;
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions,
        prompt,
        maxRetries: 0,
        output: Output.object({ schema: Schema }),
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", include: ["reasoning.encrypted_content"] } },
      });
      const out = await result.output;
      const questoes = out.questoes.filter((q) => {
        if (ce) { q.alternativas = ["Certo", "Errado"]; return q.correta === 0 || q.correta === 1; }
        q.alternativas = q.alternativas.map((a) => a.trim().replace(/^[A-Ea-e][).:-]\s+/, "")).filter(Boolean).slice(0, 5);
        return q.alternativas.length >= 2 && q.correta >= 0 && q.correta < q.alternativas.length;
      });
      return { questoes };
    } catch (e) {
      console.error("gerarQuestoes", e);
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402) return { questoes: [], error: "Créditos de IA esgotados. Adicione créditos no workspace." };
      if (status === 429) return { questoes: [], error: "Muitas solicitações. Tente novamente em instantes." };
      return { questoes: [], error: "Não foi possível gerar as questões agora." };
    }
  });

const ComentarInput = z.object({
  tipo: z.enum(["multipla_escolha", "certo_errado"]),
  enunciado: z.string().min(1).max(20000),
  alternativas: z.array(z.string().max(4000)).max(5),
  correta: z.number().int().min(0).max(4),
  disciplina: z.string().max(200).default(""),
  assuntos: z.array(z.string().max(200)).max(10).default([]),
  banca: z.string().max(200).default(""),
});

export const comentarQuestao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ComentarInput.parse(d))
  .handler(async ({ data }): Promise<{ comentario: string; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { comentario: "", error: "IA não configurada." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const ce = data.tipo === "certo_errado";
    const L = "ABCDE";
    const gabarito = ce ? (data.correta === 0 ? "CERTO" : "ERRADO") : `${L[data.correta]}`;
    const instructions = `Você é um professor especialista em concursos públicos brasileiros que escreve comentários de questões (estilo professor do QConcursos). Escreva em português do Brasil, texto corrido simples (sem markdown, sem asteriscos, sem títulos com #).
O gabarito informado é OFICIAL: fundamente-o, nunca o contradiga.
Estrutura:
1) "Gabarito: ${gabarito}" na primeira linha.
2) Fundamentação: explique o conceito cobrado, citando a base legal, doutrinária ou gramatical quando houver (artigo de lei, súmula, regra).
3) ${ce ? "Explique por que o item está " + gabarito.toLowerCase() + ", apontando o trecho decisivo." : "Analise cada alternativa em uma linha própria começando com a letra (ex.: \"A) Errada. ...\"), dizendo por que está correta ou errada."}
4) Uma dica final curta para a prova, começando com "Dica:".
Seja preciso e objetivo; não invente leis ou números de artigos se não tiver certeza.`;
    const prompt = `${data.disciplina ? `Disciplina: ${data.disciplina}\n` : ""}${data.assuntos.length ? `Assunto(s): ${data.assuntos.join(", ")}\n` : ""}${data.banca ? `Banca: ${data.banca}\n` : ""}Tipo: ${ce ? "Certo/Errado" : "Múltipla escolha"}

Enunciado:
${data.enunciado}
${ce ? "" : "\nAlternativas:\n" + data.alternativas.map((a, i) => `${L[i]}) ${a}`).join("\n")}
\nGabarito oficial: ${gabarito}`;
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions,
        prompt,
        maxRetries: 0,
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", include: ["reasoning.encrypted_content"] } },
      });
      const comentario = (await result.text).trim();
      if (!comentario) return { comentario: "", error: "A IA não retornou um comentário." };
      return { comentario };
    } catch (e) {
      console.error("comentarQuestao", e);
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402) return { comentario: "", error: "Créditos de IA esgotados. Adicione créditos no workspace." };
      if (status === 429) return { comentario: "", error: "Muitas solicitações. Tente novamente em instantes." };
      return { comentario: "", error: "Não foi possível gerar o comentário agora." };
    }
  });
