import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type QuestaoListada = Database["public"]["Functions"]["buscar_questoes"]["Returns"][number];

export type FiltrosQuestoes = {
  disciplina_id?: number | null;
  assunto_id?: number | null;
  banca_id?: number | null;
  orgao_id?: number | null;
  nivel_id?: number | null;
  ano?: number | null;
  tipo?: string;
  situacao?: string;
  busca?: string;
};

const POR_PAGINA = 20;

// Só envia os filtros preenchidos; o banco monta a consulta com o índice certo para cada combinação.
function args(f: FiltrosQuestoes) {
  const a: Database["public"]["Functions"]["contar_questoes"]["Args"] = {};
  if (f.disciplina_id) a.p_disciplina_id = f.disciplina_id;
  if (f.assunto_id) a.p_assunto_id = f.assunto_id;
  if (f.banca_id) a.p_banca_id = f.banca_id;
  if (f.orgao_id) a.p_orgao_id = f.orgao_id;
  if (f.nivel_id) a.p_nivel_id = f.nivel_id;
  if (f.ano) a.p_ano = f.ano;
  if (f.tipo) a.p_tipo = f.tipo;
  if (f.situacao) a.p_situacao = f.situacao;
  if (f.busca?.trim()) a.p_busca = f.busca.trim();
  return a;
}

/** Questões paginadas no servidor (cursor por id, mais recentes primeiro). */
export function useQuestoes(filtros: FiltrosQuestoes, userId: string | undefined) {
  const lista = useInfiniteQuery({
    queryKey: ["questoes", "lista", filtros, userId],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("buscar_questoes", {
        ...args(filtros), p_limite: POR_PAGINA, ...(pageParam ? { p_antes_de: pageParam } : {}),
      });
      if (error) throw error;
      return data;
    },
    getNextPageParam: (ultima) => (ultima.length === POR_PAGINA ? ultima[ultima.length - 1]!.id : null),
  });
  const total = useQuery({
    queryKey: ["questoes", "total", filtros, userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("contar_questoes", args(filtros));
      if (error) throw error;
      return data;
    },
  });
  return { ...lista, questoes: lista.data?.pages.flat() ?? [], total: total.data };
}

export function useAnosQuestoes() {
  const { data = [] } = useQuery({
    queryKey: ["questoes", "anos"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("anos_questoes");
      if (error) throw error;
      return data;
    },
  });
  return data;
}
