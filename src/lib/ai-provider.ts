import type { LanguageModel } from "ai";

// Provedor de IA: gateway do Lovable quando LOVABLE_API_KEY existe (rodando no Lovable);
// fora dele (ex.: Vercel), OpenRouter com OPENROUTER_API_KEY.
//
// Variáveis do OpenRouter:
//   OPENROUTER_API_KEY          obrigatória
//   OPENROUTER_MODEL            modelo de texto (padrão abaixo)
//   OPENROUTER_EMBEDDING_MODEL  modelo de embeddings da biblioteca. Precisa gerar vetores de 3072
//                               dimensões, e só acha o material indexado com esse mesmo modelo;
//                               sem ela, a biblioteca fica desligada fora do Lovable.

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1";
const OPENROUTER = "https://openrouter.ai/api/v1";
const OPENROUTER_MODELO_PADRAO = "anthropic/claude-sonnet-5.5";

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

export async function obterIA(): Promise<IA | null> {
  const { createOpenAI } = await import("@ai-sdk/openai");

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    const provider = createOpenAI({
      baseURL: LOVABLE_GATEWAY,
      apiKey: lovableKey,
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const auth = { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" };
    return {
      origem: "lovable",
      modelo: provider.responses("openai/gpt-6-astra"),
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", include: ["reasoning.encrypted_content"] } },
      embeddings: { url: `${LOVABLE_GATEWAY}/embeddings`, headers: auth, modelo: "google/gemini-embedding-2" },
      jev: { url: `${LOVABLE_GATEWAY}/systemone`, headers: { ...auth, "X-Lovable-AIG-SDK": "fetch" } },
    };
  }

  const orKey = process.env["OPENROUTER_API_KEY"];
  if (orKey) {
    const headers = { "HTTP-Referer": "https://concursos-2027.vercel.app", "X-Title": "Data5 Concursos" };
    const provider = createOpenAI({ baseURL: OPENROUTER, apiKey: orKey, headers });
    const modeloEmb = process.env["OPENROUTER_EMBEDDING_MODEL"];
    return {
      origem: "openrouter",
      modelo: provider.chat(process.env["OPENROUTER_MODEL"] || OPENROUTER_MODELO_PADRAO),
      providerOptions: {},
      embeddings: modeloEmb
        ? { url: `${OPENROUTER}/embeddings`, headers: { ...headers, Authorization: `Bearer ${orKey}`, "Content-Type": "application/json" }, modelo: modeloEmb }
        : null,
      jev: null,
    };
  }

  return null;
}

/** Mensagem amigável para erros do provedor (créditos, limite de requisições). */
export function erroIA(e: unknown, padrao: string): string {
  const status = (e as { statusCode?: number }).statusCode;
  if (status === 402) return "Créditos de IA esgotados. Adicione créditos no provedor de IA.";
  if (status === 429) return "Muitas solicitações. Tente novamente em instantes.";
  return padrao;
}
