import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ehAdmin } from "./ai-guard";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBEDDING_MODEL = "google/gemini-embedding-2";
const JEV_MODEL = "typesafe/jev-latest";

export type TrechoConhecimento = { titulo: string; conteudo: string };

function dividirEmTrechos(texto: string, alvo = 1200, overlap = 150): string[] {
  const paragrafos = texto.split(/\n{2,}/);
  const trechos: string[] = [];
  let atual = "";
  for (const p of paragrafos) {
    if (atual && (atual + "\n\n" + p).length > alvo) {
      trechos.push(atual.trim());
      atual = atual.slice(-overlap) + "\n\n" + p;
    } else {
      atual = atual ? atual + "\n\n" + p : p;
    }
  }
  if (atual.trim()) trechos.push(atual.trim());
  return trechos.filter((t) => t.length > 20).slice(0, 400);
}

async function embedTexts(apiKey: string, texts: string[]): Promise<number[][]> {
  const vetores: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const lote = texts.slice(i, i + 100);
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: lote }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`embeddings ${res.status}: ${msg.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const data = [...json.data].sort((a, b) => a.index - b.index);
    for (const d of data) vetores.push(d.embedding);
  }
  return vetores;
}

function jevHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" };
}

// Busca inteligente: embeddings + Jev (System One) julgando a relevância de cada trecho.
export async function retrieveTrechos(
  apiKey: string,
  supabase: SupabaseClient<Database>,
  consulta: string,
): Promise<TrechoConhecimento[]> {
  try {
    const [vetor] = await embedTexts(apiKey, [consulta.slice(0, 8000)]);
    if (!vetor) return [];
    const { data, error } = await supabase.rpc("match_knowledge", { query_embedding: vetor as unknown as string, match_count: 12 });
    if (error || !Array.isArray(data) || data.length === 0) return [];
    const candidatos = (data as { titulo: string; conteudo: string; similarity: number }[]).slice(0, 12);

    const trechos = candidatos.map((t, i) => ({ id: i, titulo: t.titulo, texto: t.conteudo.slice(0, 1500) }));
    const questions: Record<string, unknown> = {};
    for (const t of trechos) {
      questions[`r${t.id}`] = {
        type: "noul",
        instructions: `Dada a consulta, o trecho ${t.id} (material "${t.titulo}") traz informação útil para fundamentar ou elaborar conteúdo sobre o tema da consulta?`,
        criteria: {
          true: "O trecho contém regras, conceitos, leis ou explicações diretamente relacionadas ao tema da consulta.",
          false: "O trecho é de outro tema, muito genérico ou não ajudaria a fundamentar a consulta.",
        },
      };
    }
    let relevantes = candidatos;
    try {
      const res = await fetch(`${GATEWAY}/systemone`, {
        method: "POST",
        headers: jevHeaders(apiKey),
        body: JSON.stringify({ model: JEV_MODEL, state: { consulta, trechos }, questions }),
      });
      if (res.ok) {
        const json = (await res.json()) as { answers?: Record<string, { noul?: number }> };
        const filtrados = candidatos.filter((_, i) => (json.answers?.[`r${i}`]?.noul ?? 1) >= 0.5);
        if (filtrados.length > 0) relevantes = filtrados;
      }
    } catch (e) {
      console.error("jev relevance", e); // sem Jev, usa a ordem de similaridade
    }
    return relevantes
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 6)
      .map((t) => ({ titulo: t.titulo, conteudo: t.conteudo }));
  } catch (e) {
    console.error("retrieveTrechos", e);
    return [];
  }
}

const DocInput = z.object({
  titulo: z.string().min(1).max(300),
  disciplina_id: z.number().int().nullable().default(null),
  conteudo: z.string().min(20).max(200000),
});

export const addKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DocInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; trechos?: number; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "IA não configurada." };
    if (!(await ehAdmin(context))) return { ok: false, error: "Apenas administradores podem gerenciar a biblioteca." };
    const trechos = dividirEmTrechos(data.conteudo);
    if (trechos.length === 0) return { ok: false, error: "Conteúdo muito curto para indexar." };
    const { data: doc, error } = await context.supabase
      .from("knowledge_docs")
      .insert({ user_id: context.userId, titulo: data.titulo, disciplina_id: data.disciplina_id, conteudo: data.conteudo })
      .select("id")
      .single();
    if (error || !doc) return { ok: false, error: "Erro ao salvar o material." };
    try {
      const vetores = await embedTexts(apiKey, trechos);
      const linhas = trechos.map((t, i) => ({ doc_id: (doc as { id: number }).id, ordem: i, conteudo: t, embedding: (vetores[i] ?? []) as unknown as string }));
      const { error: chunkError } = await context.supabase.from("knowledge_chunks").insert(linhas);
      if (chunkError) throw new Error(chunkError.message);
      return { ok: true, trechos: linhas.length };
    } catch (e) {
      console.error("addKnowledgeDoc", e);
      await context.supabase.from("knowledge_docs").delete().eq("id", (doc as { id: number }).id);
      const status = (e as { message?: string }).message?.includes("402") ? 402 : undefined;
      if (status === 402) return { ok: false, error: "Créditos de IA esgotados. Adicione créditos no workspace." };
      return { ok: false, error: "Material salvo, mas houve erro ao indexar o conteúdo. Tente novamente." };
    }
  });

export const deleteKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    if (!(await ehAdmin(context))) return { ok: false, error: "Apenas administradores podem gerenciar a biblioteca." };
    const { error } = await context.supabase.from("knowledge_docs").delete().eq("id", data.id);
    if (error) return { ok: false, error: "Erro ao excluir o material." };
    return { ok: true };
  });
