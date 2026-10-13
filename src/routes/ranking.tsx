import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — Banco de Questões" },
      { name: "description", content: "Veja quem mais acerta questões de concursos." },
      { property: "og:title", content: "Ranking de concurseiros" },
      { property: "og:description", content: "Veja quem mais acerta questões de concursos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ranking,
});

function Ranking() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ranking");
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl font-bold">Ranking</h1>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr><th className="p-3">#</th><th className="p-3">Usuário</th><th className="p-3 text-right">Acertos</th><th className="p-3 text-right">Resolvidas</th><th className="p-3 text-right">Aproveitamento</th></tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.user_id} className="border-t">
                  <td className="p-3 font-display font-bold">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                  <td className="p-3 font-semibold">{r.username}</td>
                  <td className="p-3 text-right">{r.acertos}</td>
                  <td className="p-3 text-right">{r.resolvidas}</td>
                  <td className="p-3 text-right">{r.resolvidas ? Math.round((Number(r.acertos) / Number(r.resolvidas)) * 100) : 0}%</td>
                </tr>
              ))}
              {!isLoading && data.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Ninguém respondeu ainda. Seja o primeiro!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
