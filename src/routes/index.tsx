import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { useSession } from "@/hooks/use-session";
import { useCadastros } from "@/hooks/use-cadastros";
import { useAnosQuestoes, useQuestoes, type FiltrosQuestoes, type QuestaoListada } from "@/hooks/use-questoes";

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
  ["disciplina_id", "Disciplina", "disciplinas"],
  ["banca_id", "Banca", "bancas"],
  ["orgao_id", "Órgão", "orgaos"],
  ["nivel_id", "Nível", "niveis"],
] as const;

type Filtros = FiltrosQuestoes & { situacao: string };
const VAZIO: Filtros = { situacao: "nao", busca: "" };
const num = (v: string) => (v ? Number(v) : null);
const select = "rounded-xl border bg-card px-3 py-2.5 text-sm outline-none transition hover:border-primary/50 focus:ring-2 focus:ring-ring";

function Index() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: cad } = useCadastros();
  const anos = useAnosQuestoes();
  const [draft, setDraft] = useState<Filtros>(VAZIO);
  const [aplicado, setAplicado] = useState<Filtros>(VAZIO);
  const filtros = useMemo(() => ({ ...aplicado, situacao: user ? aplicado.situacao : "" }), [aplicado, user]);
  const { questoes, total, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useQuestoes(filtros, user?.id);

  const { data: stats } = useQuery({
    queryKey: ["user-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_stats").select("resolvidas, acertos").maybeSingle();
      if (error) throw error;
      return data ?? { resolvidas: 0, acertos: 0 };
    },
  });
  const done = Number(stats?.resolvidas ?? 0);
  const hits = Number(stats?.acertos ?? 0);
  const assuntoOptions = cad.assuntos.filter((a) => !draft.disciplina_id || a.disciplina_id === draft.disciplina_id);

  const responder = async (q: QuestaoListada, alt: number) => {
    if (!user) return;
    const { data, error } = await supabase.rpc("responder_questao", { p_question_id: q.id, p_alternativa: alt });
    const r = data?.[0];
    if (error || !r) { toast.error("Não foi possível salvar sua resposta."); return; }
    // atualiza só o cartão respondido; recarregar a lista tiraria a questão da tela no filtro "não resolvidas"
    qc.setQueriesData<InfiniteData<QuestaoListada[]>>({ queryKey: ["questoes", "lista"] }, (old) => old && {
      ...old,
      pages: old.pages.map((pg) => pg.map((x) => (x.id === q.id
        ? { ...x, respondida: r.alternativa, acertou: r.acertou, correta: r.correta, comentario: r.comentario } : x))),
    });
    qc.invalidateQueries({ queryKey: ["user-stats", user.id] });
    qc.invalidateQueries({ queryKey: ["questoes", "total"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="relative overflow-hidden border-b bg-card">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-g-blue/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute right-40 top-20 h-48 w-48 rounded-full bg-g-yellow/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-g-green/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            <span className="flex gap-0.5"><i className="h-2 w-2 rounded-full bg-g-blue" /><i className="h-2 w-2 rounded-full bg-g-red" /><i className="h-2 w-2 rounded-full bg-g-yellow" /><i className="h-2 w-2 rounded-full bg-g-green" /></span>
            Banco de questões de concursos
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            Treine com questões e <span className="text-primary">chegue lá</span>.
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">Filtre por disciplina, banca, órgão e nível. Responda, veja o gabarito comentado e suba no ranking.</p>
          {user ? (
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3">
              <Stat label="Resolvidas" value={done} color="bg-g-blue" />
              <Stat label="Acertos" value={hits} color="bg-g-green" />
              <Stat label="Aproveitamento" value={`${done ? Math.round((hits / done) * 100) : 0}%`} color="bg-g-yellow" />
            </div>
          ) : (
            <Link to="/auth" className="mt-7 inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-soft transition hover:shadow-lift">
              Entrar e começar a resolver
            </Link>
          )}
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <form className="mb-8 rounded-2xl border bg-card p-5 shadow-soft"
          onSubmit={(e) => { e.preventDefault(); setAplicado(draft); }}>
          <h2 className="mb-4 text-lg font-semibold">Filtrar questões</h2>
          <input value={draft.busca} onChange={(e) => setDraft({ ...draft, busca: e.target.value })} placeholder="Palavra-chave no enunciado, ou o número da questão (ex.: Q123)..."
            className="mb-3 w-full rounded-full border bg-muted px-5 py-3 outline-none transition focus:bg-card focus:ring-2 focus:ring-ring" />
          <div className="grid gap-3 sm:grid-cols-4">
            {FILTERS.map(([k, label, tabela]) => (
              <select key={k} value={draft[k] ?? ""} className={select}
                onChange={(e) => setDraft({ ...draft, [k]: num(e.target.value), ...(k === "disciplina_id" ? { assunto_id: null } : {}) })}>
                <option value="">{label}: todas</option>
                {cad[tabela].map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            ))}
            <select value={draft.assunto_id ?? ""} onChange={(e) => setDraft({ ...draft, assunto_id: num(e.target.value) })} className={select}>
              <option value="">Assunto: todos</option>
              {assuntoOptions.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <select value={draft.ano ?? ""} onChange={(e) => setDraft({ ...draft, ano: num(e.target.value) })} className={select}>
              <option value="">Ano: todos</option>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={draft.tipo ?? ""} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })} className={select}>
              <option value="">Tipo: todos</option>
              <option value="multipla_escolha">Múltipla escolha</option>
              <option value="certo_errado">Certo/Errado</option>
            </select>
            {user && (
              <select value={draft.situacao} onChange={(e) => setDraft({ ...draft, situacao: e.target.value })} className={select}>
                <option value="">Situação: todas</option>
                <option value="nao">Não resolvidas</option>
                <option value="resolvidas">Resolvidas</option>
                <option value="acertei">Acertei</option>
                <option value="errei">Errei</option>
              </select>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-soft transition hover:shadow-lift">Aplicar filtros</button>
            <button type="button" className="text-sm text-muted-foreground underline"
              onClick={() => { setDraft(VAZIO); setAplicado(VAZIO); }}>Limpar</button>
            <p className="text-sm text-muted-foreground">{total == null ? "Contando..." : `${Number(total).toLocaleString("pt-BR")} questões encontradas`}</p>
          </div>
        </form>

        <div className="space-y-5">
          {questoes.map((q) => (
            <QuestionCard key={q.id} q={q} canAnswer={!!user} onAnswer={(a) => responder(q, a)} />
          ))}
          {isLoading && <p className="text-center text-sm text-muted-foreground">Carregando...</p>}
          {hasNextPage && (
            <div className="text-center">
              <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                className="rounded-full border px-6 py-2.5 font-semibold transition hover:bg-muted disabled:opacity-50">
                {isFetchingNextPage ? "Carregando..." : "Carregar mais questões"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m?.[1] ?? null;
}

function QuestionCard({ q, canAnswer, onAnswer }: { q: QuestaoListada; canAnswer: boolean; onAnswer: (a: number) => Promise<void> }) {
  const [sel, setSel] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [showCom, setShowCom] = useState(false);
  const answered = q.respondida;
  const isAnswered = answered !== null;
  const letters = "ABCDE";
  const CE = ["Certo", "Errado"];
  const ce = q.tipo === "certo_errado";

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:shadow-lift">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-3 text-xs text-muted-foreground">
        <b className="rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground">Q{q.id}</b>
        <span>{q.disciplina} › {q.assuntos.join(", ")}</span>
        <span>Banca: {q.banca}</span>
        <span>Órgão: {q.orgao}</span>
        <span>Ano: {q.ano}</span>
        {q.nivel && <span>Nível: {q.nivel}</span>}
        <span className={`rounded-full px-2.5 py-0.5 font-semibold ${ce ? "bg-g-yellow/20 text-foreground" : "bg-g-blue/10 text-primary"}`}>{ce ? "Certo/Errado" : "Múltipla escolha"}</span>
        {isAnswered && (
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${q.acertou ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
            ✓ {q.acertou ? "Acertou" : "Errou"}
          </span>
        )}
      </div>
      <div className="p-6">
        <p className="mb-5 whitespace-pre-line text-[15px] leading-relaxed">{q.enunciado}</p>
        {q.imagem_url && (
          <img src={q.imagem_url} alt="Imagem da questão" loading="lazy" className="mb-4 max-h-96 rounded-lg border object-contain" />
        )}
        {youtubeId(q.video_url) && (
          <div className="mb-4 aspect-video max-w-2xl overflow-hidden rounded-lg border">
            <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${youtubeId(q.video_url)}`} loading="lazy"
              title="Vídeo da questão" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        )}
        <ul className="space-y-2">
          {(ce ? CE : q.alternativas).map((alt, i) => {
            const state = isAnswered
              ? i === q.correta ? "border-success bg-success/10" : i === answered ? "border-destructive bg-destructive/10" : ""
              : sel === i ? "border-primary bg-secondary ring-1 ring-primary" : "";
            return (
              <li key={i}>
                <button disabled={isAnswered || !canAnswer} onClick={() => setSel(i)}
                  className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition hover:bg-muted disabled:cursor-default ${state}`}>
                  {!ce && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold transition group-hover:border-primary group-hover:text-primary">{letters[i]}</span>}
                  <span className={ce ? "font-semibold" : ""}>{alt}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!canAnswer ? null : !isAnswered ? (
            <button disabled={sel === null || enviando}
              onClick={async () => { if (sel === null) return; setEnviando(true); await onAnswer(sel); setEnviando(false); }}
              className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-soft transition hover:shadow-lift disabled:opacity-40 disabled:shadow-none">Responder</button>
          ) : (
            <span className={`font-semibold ${q.acertou ? "text-success" : "text-destructive"}`}>
              {q.acertou ? "Parabéns! Você acertou." : `Você errou. Gabarito: ${q.correta === null ? "?" : ce ? CE[q.correta] : letters[q.correta]}`}
            </span>
          )}
          {q.comentario && (
            <button onClick={() => setShowCom(!showCom)} className="rounded-full px-3 py-2 text-sm font-semibold text-primary transition hover:bg-secondary">
              {showCom ? "Ocultar" : "Ver"} comentário
            </button>
          )}
        </div>
        {showCom && <p className="mt-4 rounded-xl border-l-4 border-g-yellow bg-muted p-4 text-sm leading-relaxed">{q.comentario}</p>}
      </div>
    </article>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <span className={`mb-2 block h-1.5 w-8 rounded-full ${color}`} />
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
