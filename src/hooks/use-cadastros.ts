import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type CadastroTabela = "disciplinas" | "assuntos" | "bancas" | "orgaos" | "niveis";

export function useCadastros() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["cadastros"],
    queryFn: async () => {
      const [d, a, b, o, n] = await Promise.all([
        supabase.from("disciplinas").select("*").order("nome"),
        supabase.from("assuntos").select("*").order("nome"),
        supabase.from("bancas").select("*").order("nome"),
        supabase.from("orgaos").select("*").order("nome"),
        supabase.from("niveis").select("*").order("nome"),
      ]);
      return { disciplinas: d.data ?? [], assuntos: a.data ?? [], bancas: b.data ?? [], orgaos: o.data ?? [], niveis: n.data ?? [] };
    },
  });

  const adicionar = async (tabela: CadastroTabela, nome: string, disciplina_id?: number): Promise<number | null> => {
    const n = nome.trim();
    if (!n) return null;
    const res = tabela === "assuntos"
      ? await supabase.from("assuntos").insert({ nome: n, disciplina_id: disciplina_id! }).select("id").single()
      : await supabase.from(tabela).insert({ nome: n }).select("id").single();
    if (res.error) { toast.error(res.error.code === "23505" ? "Esse nome já existe." : "Erro ao cadastrar."); return null; }
    await qc.invalidateQueries({ queryKey: ["cadastros"] });
    return res.data.id;
  };

  return { data: q.data ?? { disciplinas: [], assuntos: [], bancas: [], orgaos: [], niveis: [] }, adicionar, refresh: () => qc.invalidateQueries({ queryKey: ["cadastros"] }) };
}
