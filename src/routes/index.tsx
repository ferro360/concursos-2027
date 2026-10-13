import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { questions, unique, type Question } from "@/lib/questions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Banco de Questões — Resolva questões de concursos" },
      { name: "description", content: "Resolva questões de concursos públicos filtrando por disciplina, banca, órgão e ano, com gabarito comentado." },
      { property: "og:title", content: "Banco de Questões de Concursos" },
      { property: "og:description", content: "Questões de concursos com filtros e gabarito comentado." },
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

type Answers = Record<number, number>;

function Index() {
  const [f, setF] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    const s = localStorage.getItem("qc-answers");
    if (s) setAnswers(JSON.parse(s));
  }, []);
  const save = (a: Answers) => { setAnswers(a); localStorage.setItem("qc-answers", JSON.stringify(a)); };

  const list = useMemo(() => questions.filter((q) =>
    FILTERS.every(([k]) => !f[k] || String(q[k]) === f[k]) &&
    (!busca || (q.enunciado + q.assunto).toLowerCase().includes(busca.toLowerCase()))
  ), [f, busca]);

  const done = Object.keys(answers).length;
  const hits = Object.entries(answers).filter(([id, a]) => questions.find((q) => q.id === +id)?.correta === a).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="font-display text-2xl font-bold">Questões<span className="text-accent">.</span></h1>
          <div className="flex gap-4 text-sm">
            <span>Resolvidas: <b>{done}</b></span>
            <span>Acertos: <b>{done ? Math.round((hits / done) * 100) : 0}%</b></span>
            {done > 0 && <button className="underline opacity-80" onClick={() => save({})}>zerar</button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="mb-8 rounded-xl border bg-card p-4 shadow-sm">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por palavra-chave ou assunto..."
            className="mb-3 w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          <div className="grid gap-3 sm:grid-cols-4">
            {FILTERS.map(([k, label]) => (
              <select key={k} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })}
                className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">{label}: todas</option>
                {unique(k).map((v) => <option key={v}>{v}</option>)}
              </select>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{list.length} questões encontradas</p>
        </section>

        <div className="space-y-6">
          {list.map((q, i) => (
            <QuestionCard key={q.id} q={q} n={i + 1} answered={answers[q.id]}
              onAnswer={(a) => save({ ...answers, [q.id]: a })} />
          ))}
        </div>
      </main>
    </div>
  );
}

function QuestionCard({ q, n, answered, onAnswer }: { q: Question; n: number; answered?: number | undefined; onAnswer: (a: number) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const [showCom, setShowCom] = useState(false);
  const isAnswered = answered !== undefined;
  const letters = "ABCDE";

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b bg-muted px-4 py-2 text-xs text-muted-foreground">
        <b className="text-foreground">Q{q.id} · {n}</b>
        <span>{q.disciplina} › {q.assunto}</span>
        <span>Banca: {q.banca}</span>
        <span>Órgão: {q.orgao}</span>
        <span>Ano: {q.ano}</span>
      </div>
      <div className="p-5">
        <p className="mb-4 leading-relaxed">{q.enunciado}</p>
        <ul className="space-y-2">
          {q.alternativas.map((alt, i) => {
            const state = isAnswered
              ? i === q.correta ? "border-success bg-success/10" : i === answered ? "border-destructive bg-destructive/10" : ""
              : sel === i ? "border-primary bg-primary/5" : "";
            return (
              <li key={i}>
                <button disabled={isAnswered} onClick={() => setSel(i)}
                  className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition hover:bg-muted disabled:cursor-default ${state}`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-semibold">{letters[i]}</span>
                  {alt}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!isAnswered ? (
            <button disabled={sel === null} onClick={() => sel !== null && onAnswer(sel)}
              className="rounded-md bg-accent px-5 py-2 font-semibold text-accent-foreground disabled:opacity-40">Responder</button>
          ) : (
            <span className={`font-semibold ${answered === q.correta ? "text-success" : "text-destructive"}`}>
              {answered === q.correta ? "Parabéns! Você acertou." : `Você errou. Gabarito: ${letters[q.correta]}`}
            </span>
          )}
          <button onClick={() => setShowCom(!showCom)} className="text-sm text-primary underline">
            {showCom ? "Ocultar" : "Ver"} comentário
          </button>
        </div>
        {showCom && <p className="mt-3 rounded-md bg-muted p-3 text-sm">{q.comentario}</p>}
      </div>
    </article>
  );
}
