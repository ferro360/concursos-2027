import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  disciplina: z.string().min(1).max(200),
  assuntos: z.array(z.string().max(200)).min(1).max(10),
  banca: z.string().max(200),
  nivel: z.string().max(200),
  tipo: z.enum(["multipla_escolha", "certo_errado"]),
  quantidade: z.number().int().min(1).max(10),
  instrucoes: z.string().max(2000),
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
Assunto(s): ${data.assuntos.join(", ")}
${data.banca ? `Estilo da banca: ${data.banca}` : ""}
${data.nivel ? `Escolaridade: ${data.nivel}` : ""}
${data.instrucoes ? `Instruções adicionais: ${data.instrucoes}` : ""}`;
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
