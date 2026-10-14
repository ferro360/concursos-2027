import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ehAdmin } from "./ai-guard";
import { chavesConfiguradas } from "./ai-provider";

export type ChavesIA = ReturnType<typeof chavesConfiguradas>;

// Só diz se cada chave existe no servidor; os valores nunca saem dele.
export const statusIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ chaves?: ChavesIA; error?: string }> => {
    if (!(await ehAdmin(context))) return { error: "Apenas administradores." };
    return { chaves: chavesConfiguradas() };
  });
