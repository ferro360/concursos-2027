import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { retrieveTrechos } from "./knowledge.functions";
import { consumirCotaIA, COTA_ESGOTADA } from "./ai-guard";
import { comPlanoB, erroIA, IA_NAO_CONFIGURADA, obterIAs } from "./ai-provider";

const PERGUNTAS_POR_DIA = 30;

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
    const ias = await obterIAs(context.supabase);
    const ia = ias.lista[0];
    if (!ia) return { resposta: "", fontes: [], error: IA_NAO_CONFIGURADA };
    if (!(await consumirCotaIA(context, PERGUNTAS_POR_DIA))) return { resposta: "", fontes: [], error: COTA_ESGOTADA };
    const { streamText } = await import("ai");

    // Base de conhecimento da plataforma (busca inteligente + Jev).
    const trechos = await retrieveTrechos(ias.lista, context.supabase, `${data.disciplina} ${data.pergunta}`.slice(0, 8000));
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
      const resposta = (await comPlanoB(ias, (m) => streamText({
        model: m.modelo,
        instructions,
        messages: mensagens,
        maxRetries: 0,
        providerOptions: m.providerOptions,
      }).text)).trim();
      if (!resposta) return { resposta: "", fontes: [], error: "A IA não retornou uma resposta." };
      // Só aparece como fonte o material que a resposta realmente citou.
      return { resposta, fontes: fontes.filter((f) => citado(resposta, f.titulo)) };
    } catch (e) {
      console.error("perguntarProfessor", e);
      return { resposta: "", fontes: [], error: erroIA(e, "Não foi possível responder agora.") };
    }
  });
