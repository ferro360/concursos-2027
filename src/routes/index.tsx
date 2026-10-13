import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SiteHeader } from "@/components/site-header";
import { useSession } from "@/hooks/use-session";

type Question = Tables<"questions">;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Banco de Questões — Resolva questões de concursos" },
      { name: "description", content: "Resolva questões de concursos públicos filtrando por disciplina, banca, órgão e ano, com gabarito comentado e ranking." },
      { property: "og:title", content: "Banco de Questões de Concursos" },
      { property: "og:description", content: "Questões de concursos com filtros, gabarito comentado e ranking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const FILTERS = [
  ["disciplina", "Disciplina"],
  ["banca", "Banca"],
  ["orgao", "Órgão"],
  ["ano", "Ano"],
] as const;

function Index() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [f, setF] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });

  const { data: answers = {} } = useQuery({
    queryKey: ["answers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("answers").select("question_id, alternativa, acertou");
      if (error) throw error;
      return Object.fromEntries(data.map((a) => [a.question_id, a]));
    },
  });

  // mapa questão -> nomes de todos os assuntos vinculados
  const { data: assuntosPorQuestao = {} } = useQuery({
    queryKey: ["question-assuntos"],
    queryFn: async () => {
      const [{ data: links, error: e1 }, { data: assuntos, error: e2 }] = await Promise.all([
        supabase.from("question_assuntos").select("question_id, assunto_id"),
        supabase.from("assuntos").select("id, nome"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const nomes = Object.fromEntries(assuntos.map((a) => [a.id, a.nome]));
      const map: Record<number, string[]> = {};
      for (const l of links) (map[l.question_id] ??= []).push(nomes[l.assunto_id] ?? "");
      return map;
    },
  });

  const assuntosDe = (q: Question) => assuntosPorQuestao[q.id]?.filter(Boolean) ?? [q.assunto];

  const list = useMemo(() => questions.filter((q) =>
    FILTERS.every(([k]) => !f[k] || String(q[k]) === f[k]) &&
    (!busca || (q.enunciado + " " + assuntosDe(q).join(" ")).toLowerCase().includes(busca.toLowerCase()))
  ), [questions, f, busca, assuntosPorQuestao]);

  const options = (k: (typeof FILTERS)[number][0]) => Array.from(new Set(questions.map((q) => String(q[k])))).sort();
  const vals = Object.values(answers);
  const done = vals.length;
  const hits = vals.filter((a) => a.acertou).length;

  const responder = async (q: Question, alt: number) => {
    if (!user) return;
    const { error } = await supabase.from("answers").insert({ user_id: user.id, question_id: q.id, alternativa: alt });
    if (error) { toast.error("Não foi possível salvar sua resposta."); return; }
    qc.invalidateQueries({ queryKey: ["answers", user.id] });
  };

  const zerar = async () => {
    if (!user || !confirm("Apagar todas as suas respostas?")) return;
    await supabase.from("answers").delete().eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["answers", user.id] });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {user ? (
          <div className="mb-4 flex gap-4 text-sm">
            <span>Resolvidas: <b>{done}</b></span>
            <span>Acertos: <b>{done ? Math.round((hits / done) * 100) : 0}%</b></span>
            {done > 0 && <button className="text-muted-foreground underline" onClick={zerar}>zerar</button>}
          </div>
        ) : (
          <p className="mb-4 rounded-md bg-muted p-3 text-sm">
            <Link to="/auth" className="font-semibold text-primary underline">Entre</Link> para responder, salvar seu progresso e aparecer no ranking.
          </p>
        )}

        <section className="mb-8 rounded-xl border bg-card p-4 shadow-sm">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por palavra-chave ou assunto..."
            className="mb-3 w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          <div className="grid gap-3 sm:grid-cols-4">
            {FILTERS.map(([k, label]) => (
              <select key={k} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })}
                className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">{label}: todas</option>
                {options(k).map((v) => <option key={v}>{v}</option>)}
              </select>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{isLoading ? "Carregando..." : `${list.length} questões encontradas`}</p>
        </section>

        <div className="space-y-6">
          {list.map((q) => (
            <QuestionCard key={q.id} q={q} canAnswer={!!user} answered={answers[q.id]?.alternativa}
              onAnswer={(a) => responder(q, a)} />
          ))}
        </div>
      </main>
    </div>
  );
}

function QuestionCard({ q, canAnswer, answered, onAnswer }: { q: Question; canAnswer: boolean; answered?: number | undefined; onAnswer: (a: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const [showCom, setShowCom] = useState(false);
  const isAnswered = answered !== undefined;
  const letters = "ABCDE";

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b bg-muted px-4 py-2 text-xs text-muted-foreground">
        <b className="text-foreground">Q{q.id}</b>
        <span>{q.disciplina} › {q.assunto}</span>
        <span>Banca: {q.banca}</span>
        <span>Órgão: {q.orgao}</span>
        <span>Ano: {q.ano}</span>
      </div>
      <div className="p-5">
        <p className="mb-4 whitespace-pre-line leading-relaxed">{q.enunciado}</p>
        <ul className="space-y-2">
          {q.alternativas.map((alt, i) => {
            const state = isAnswered
              ? i === q.correta ? "border-success bg-success/10" : i === answered ? "border-destructive bg-destructive/10" : ""
              : sel === i ? "border-primary bg-primary/5" : "";
            return (
              <li key={i}>
                <button disabled={isAnswered || !canAnswer} onClick={() => setSel(i)}
                  className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition hover:bg-muted disabled:cursor-default ${state}`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-semibold">{letters[i]}</span>
                  {alt}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!canAnswer ? null : !isAnswered ? (
            <button disabled={sel === null} onClick={() => sel !== null && onAnswer(sel)}
              className="rounded-md bg-accent px-5 py-2 font-semibold text-accent-foreground disabled:opacity-40">Responder</button>
          ) : (
            <span className={`font-semibold ${answered === q.correta ? "text-success" : "text-destructive"}`}>
              {answered === q.correta ? "Parabéns! Você acertou." : `Você errou. Gabarito: ${letters[q.correta]}`}
            </span>
          )}
          {q.comentario && (
            <button onClick={() => setShowCom(!showCom)} className="text-sm text-primary underline">
              {showCom ? "Ocultar" : "Ver"} comentário
            </button>
          )}
        </div>
        {showCom && <p className="mt-3 rounded-md bg-muted p-3 text-sm">{q.comentario}</p>}
      </div>
    </article>
  );
}
