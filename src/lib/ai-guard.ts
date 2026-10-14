import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

export const SO_ADMIN = "Apenas administradores podem usar este recurso.";
export const COTA_ESGOTADA = "Você atingiu o limite diário de perguntas. Volte amanhã!";

export async function ehAdmin({ supabase, userId }: Ctx): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

// Conta um uso de IA do dia para o usuário; false quando o limite foi atingido (admins não têm limite).
export async function consumirCotaIA({ supabase }: Ctx, limite: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("consumir_cota_ia", { p_limite: limite });
  if (error) console.error("consumir_cota_ia", error);
  return !error && !!data;
}
