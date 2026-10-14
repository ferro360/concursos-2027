import type { LanguageModel } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Provedores de IA:
//   - gateway do Lovable (LOVABLE_API_KEY, existe quando roda no Lovable; usa os créditos do workspace)
//   - OpenRouter (OPENROUTER_API_KEY), usado fora do Lovable ou como plano B quando o principal falha
//     (créditos esgotados, limite de requisições, erro do servidor).
// Qual é o principal, se há plano B e o modelo do OpenRouter vêm da tabela ia_config (Admin → IA).
//
// Variáveis (segredos ficam só no servidor: Secrets do Lovable / variáveis da Vercel):
//   OPENROUTER_API_KEY          chave do OpenRouter
//   OPENROUTER_MODEL            modelo de texto quando o admin não escolheu um (padrão abaixo)
//   OPENROUTER_EMBEDDING_MODEL  modelo de embeddings para a biblioteca fora do Lovable. Precisa gerar
//                               vetores de 3072 dimensões e só acha material indexado com ele mesmo.

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1";
const OPENROUTER = "https://openrouter.ai/api/v1";
export const OPENROUTER_MODELO_PADRAO = "anthropic/claude-sonnet-5.5";

export type Embeddings = { url: string; headers: Record<string, string>; modelo: string };

export type IA = {
  origem: "lovable" | "openrouter";
  modelo: LanguageModel;
  providerOptions: Record<string, Record<string, string | number | boolean | string[]>>;
  /** null quando não há modelo de embeddings configurado */
  embeddings: Embeddings | null;
  /** Jev (julgamento de relevância) só existe no gateway do Lovable */
  jev: { url: string; headers: Record<string, string> } | null;
};

export const IA_NAO_CONFIGURADA = "IA não configurada.";

export type ConfigIA = { provedor: string; plano_b: boolean; openrouter_modelo: string };

async function lerConfig(supabase: SupabaseClient<Database>): Promise<ConfigIA> {
  const { data } = await supabase.from("ia_config").select("provedor, plano_b, openrouter_modelo").maybeSingle();
  return data ?? { provedor: "lovable", plano_b: true, openrouter_modelo: "" };
}

export type IAs = { lista: IA[]; planoB: boolean };

/** Provedores com chave configurada, o principal (escolhido pelo admin) primeiro. Lista vazia se não houver chave. */
export async function obterIAs(supabase: SupabaseClient<Database>): Promise<IAs> {
  const config = await lerConfig(supabase);
  const { createOpenAI } = await import("@ai-sdk/openai");
  const ias: IA[] = [];

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    const provider = createOpenAI({
      baseURL: LOVABLE_GATEWAY,
      apiKey: lovableKey,
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const auth = { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" };
    ias.push({
      origem: "lovable",
      modelo: provider.responses("openai/gpt-6-astra"),
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", include: ["reasoning.encrypted_content"] } },
      embeddings: { url: `${LOVABLE_GATEWAY}/embeddings`, headers: auth, modelo: "google/gemini-embedding-2" },
      jev: { url: `${LOVABLE_GATEWAY}/systemone`, headers: { ...auth, "X-Lovable-AIG-SDK": "fetch" } },
    });
  }

  const orKey = process.env["OPENROUTER_API_KEY"];
  if (orKey) {
    const headers = { "HTTP-Referer": "https://concursos-2027.vercel.app", "X-Title": "Data5 Concursos" };
    const provider = createOpenAI({ baseURL: OPENROUTER, apiKey: orKey, headers });
    const modeloEmb = process.env["OPENROUTER_EMBEDDING_MODEL"];
    ias.push({
      origem: "openrouter",
      modelo: provider.chat(config.openrouter_modelo.trim() || process.env["OPENROUTER_MODEL"] || OPENROUTER_MODELO_PADRAO),
      providerOptions: {},
      embeddings: modeloEmb
        ? { url: `${OPENROUTER}/embeddings`, headers: { ...headers, Authorization: `Bearer ${orKey}`, "Content-Type": "application/json" }, modelo: modeloEmb }
        : null,
      jev: null,
    });
  }

  // a lista tem no máximo [lovable, openrouter]
  if (config.provedor === "openrouter") ias.reverse();
  return { lista: ias, planoB: config.plano_b };
}

/**
 * Provedor da biblioteca: os vetores precisam vir sempre do mesmo modelo que indexou o material,
 * então o Lovable tem prioridade sempre que existir, mesmo com IA_PROVEDOR=openrouter.
 */
export function iaDaBiblioteca(ias: IA[]): IA | null {
  return ias.find((ia) => ia.origem === "lovable") ?? ias[0] ?? null;
}

function statusDe(e: unknown): number | undefined {
  return (e as { statusCode?: number }).statusCode;
}

// Vale tentar outro provedor? Créditos (402), limite (429), erro do servidor (5xx) ou falha de rede.
function tentarOutro(e: unknown): boolean {
  const s = statusDe(e);
  return s === undefined || s === 402 || s === 408 || s === 429 || s >= 500;
}

/** Executa a chamada no provedor preferido; se falhar por créditos/limite/indisponibilidade, tenta o próximo. */
export async function comPlanoB<T>({ lista, planoB }: IAs, chamada: (ia: IA) => PromiseLike<T>): Promise<T> {
  const ias = planoB ? lista : lista.slice(0, 1);
  let ultimoErro: unknown;
  for (const [i, ia] of ias.entries()) {
    try {
      return await chamada(ia);
    } catch (e) {
      ultimoErro = e;
      const proxima = ias[i + 1];
      if (!proxima || !tentarOutro(e)) break;
      console.warn(`IA ${ia.origem} falhou (status ${statusDe(e) ?? "?"}); tentando ${proxima.origem}.`);
    }
  }
  throw ultimoErro;
}

/** Mensagem amigável para erros do provedor (créditos, limite de requisições). */
export function erroIA(e: unknown, padrao: string): string {
  const status = statusDe(e);
  if (status === 402) return "Créditos de IA esgotados. Adicione créditos no provedor de IA.";
  if (status === 429) return "Muitas solicitações. Tente novamente em instantes.";
  return padrao;
}

/** O que está configurado no servidor, sem expor valores de chaves. */
export function chavesConfiguradas() {
  return {
    lovable: !!process.env["LOVABLE_API_KEY"],
    openrouter: !!process.env["OPENROUTER_API_KEY"],
    openrouterEmbeddings: !!process.env["OPENROUTER_EMBEDDING_MODEL"],
    openrouterModeloPadrao: process.env["OPENROUTER_MODEL"] || OPENROUTER_MODELO_PADRAO,
  };
}
