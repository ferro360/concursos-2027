import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { retrieveTrechos } from "./knowledge.functions";

const Input = z.object({
  pergunta: z.string().min(1).max(4000),
  historico: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([]),
  disciplina: z.string().max(200).default(""),
});

export type Fonte = { titulo: string; trecho: string };

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// O material só é exibido como fonte se o nome dele aparecer na resposta.
function citado(resposta: string, titulo: string): boolean {
  const t = normalizar(titulo);
  return !!t && normalizar(resposta).includes(t);
}

export const perguntarProfessor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<{ resposta: string; fontes: Fonte[]; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { resposta: "", fontes: [], error: "IA não configurada." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    // Base de conhecimento da plataforma (busca inteligente + Jev).
    const trechos = await retrieveTrechos(apiKey, context.supabase, `${data.disciplina} ${data.pergunta}`.slice(0, 8000));
    const fontes: Fonte[] = [];
    for (const t of trechos) {
      if (!fontes.some((f) => f.titulo === t.titulo)) fontes.push({ titulo: t.titulo, trecho: t.conteudo.slice(0, 220) });
    }
    const base = trechos.length
      ? `\n\nBASE DE CONHECIMENTO da plataforma (material de estudo cadastrado; quando for relevante, fundamente com base nele e cite o nome do material entre parênteses):\n${trechos.map((t, i) => `[${i + 1}] ${t.titulo}\n${t.conteudo}`).join("\n\n")}`
      : "";

    const instructions = `Você é o "Professor IA" da Data5 Concursos, um professor experiente de concursos públicos brasileiros. Escreva em português do Brasil, em texto corrido simples (sem markdown, sem asteriscos, sem títulos com #).
Responda apenas a dúvida feita, de forma clara, direta e didática, em no máximo 350 palavras.
Explique o conceito, dê um exemplo prático quando ajudar e, se for o caso, cite a base legal (artigo de lei, súmula, regra) apenas quando tiver certeza do número.
${base}
Só cite um material da base se ele realmente sustentar o que você escreveu, copiando o nome dele exatamente como aparece, entre parênteses. Se nenhum material for útil, não cite nenhum e diga que a base não cobre o assunto.
Se a base de conhecimento não cobre o assunto, responda com seu conhecimento geral e diga isso de forma breve. Se não souber, admita com honestidade — nunca invente lei, número de artigo, prazo ou súmula.
Termine com uma frase curta começando com "Dica:" voltada para a prova.`;

    const mensagens = [
      ...data.historico.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: `${data.disciplina ? `Disciplina: ${data.disciplina}\n` : ""}${data.pergunta}` },
    ];

    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions,
        messages: mensagens,
        maxRetries: 0,
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", include: ["reasoning.encrypted_content"] } },
      });
      const resposta = (await result.text).trim();
      if (!resposta) return { resposta: "", fontes: [], error: "A IA não retornou uma resposta." };
      // Só aparece como fonte o material que a resposta realmente citou.
      return { resposta, fontes: fontes.filter((f) => citado(resposta, f.titulo)) };
    } catch (e) {
      console.error("perguntarProfessor", e);
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402) return { resposta: "", fontes: [], error: "Créditos de IA esgotados. Adicione créditos no workspace." };
      if (status === 429) return { resposta: "", fontes: [], error: "Muitas solicitações. Tente novamente em instantes." };
      return { resposta: "", fontes: [], error: "Não foi possível responder agora." };
    }
  });
