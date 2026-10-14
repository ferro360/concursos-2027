import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { retrieveTrechos } from "./knowledge.functions";
import { ehAdmin, SO_ADMIN } from "./ai-guard";
import { comPlanoB, erroIA, IA_NAO_CONFIGURADA, obterIAs } from "./ai-provider";

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
  .handler(async ({ data, context }): Promise<{ questoes: QuestaoGerada[]; error?: string }> => {
    const ias = await obterIAs(context.supabase);
    const ia = ias.lista[0];
    if (!ia) return { questoes: [], error: IA_NAO_CONFIGURADA };
    if (!(await ehAdmin(context))) return { questoes: [], error: SO_ADMIN };
    const { streamText, Output } = await import("ai");
    // Base de conhecimento da plataforma (busca inteligente + Jev), quando o usuário não colou conteúdo.
    let base = "";
    if (!data.conteudo) {
      const trechos = await retrieveTrechos(ias.lista, context.supabase, `${data.disciplina} ${data.assuntos.join(" ")} ${data.instrucoes}`);
      if (trechos.length) {
        base = `\n\nBASE DE CONHECIMENTO da plataforma (material de estudo cadastrado; use como referência principal e mantenha fidelidade a ele):\n${trechos.map((t, i) => `[${i + 1}] ${t.titulo}\n${t.conteudo}`).join("\n\n")}`;
      }
    }
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
${data.conteudo ? `\nBaseie as questões EXCLUSIVAMENTE no conteúdo abaixo (não invente fatos fora dele):\n"""\n${data.conteudo}\n"""` : base}`;
    try {
      const out = await comPlanoB(ias, (m) => streamText({
        model: m.modelo,
        instructions,
        prompt,
        maxRetries: 0,
        output: Output.object({ schema: Schema }),
        providerOptions: m.providerOptions,
      }).output);
      const questoes = out.questoes.filter((q) => {
        if (ce) { q.alternativas = ["Certo", "Errado"]; return q.correta === 0 || q.correta === 1; }
        q.alternativas = q.alternativas.map((a) => a.trim().replace(/^[A-Ea-e][).:-]\s+/, "")).filter(Boolean).slice(0, 5);
        return q.alternativas.length >= 2 && q.correta >= 0 && q.correta < q.alternativas.length;
      });
      return { questoes };
    } catch (e) {
      console.error("gerarQuestoes", e);
      return { questoes: [], error: erroIA(e, "Não foi possível gerar as questões agora.") };
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
  .handler(async ({ data, context }): Promise<{ comentario: string; error?: string }> => {
    const ias = await obterIAs(context.supabase);
    const ia = ias.lista[0];
    if (!ia) return { comentario: "", error: IA_NAO_CONFIGURADA };
    if (!(await ehAdmin(context))) return { comentario: "", error: SO_ADMIN };
    const { streamText } = await import("ai");
    const ce = data.tipo === "certo_errado";
    const L = "ABCDE";
    const gabarito = ce ? (data.correta === 0 ? "CERTO" : "ERRADO") : `${L[data.correta]}`;
    // Base de conhecimento da plataforma (busca inteligente + Jev).
    const trechos = await retrieveTrechos(ias.lista, context.supabase, `${data.disciplina} ${data.assuntos.join(" ")} ${data.enunciado}`.slice(0, 8000));
    const base = trechos.length
      ? `\n\nBASE DE CONHECIMENTO da plataforma (material de estudo cadastrado; quando ele for relevante, fundamente com base nele e cite o nome do material entre parênteses):\n${trechos.map((t, i) => `[${i + 1}] ${t.titulo}\n${t.conteudo}`).join("\n\n")}`
      : "";
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
\nGabarito oficial: ${gabarito}${base}`;
    try {
      const comentario = (await comPlanoB(ias, (m) => streamText({
        model: m.modelo,
        instructions,
        prompt,
        maxRetries: 0,
        providerOptions: m.providerOptions,
      }).text)).trim();
      if (!comentario) return { comentario: "", error: "A IA não retornou um comentário." };
      return { comentario };
    } catch (e) {
      console.error("comentarQuestao", e);
      return { comentario: "", error: erroIA(e, "Não foi possível gerar o comentário agora.") };
    }
  });
