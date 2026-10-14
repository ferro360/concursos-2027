import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { useCadastros } from "@/hooks/use-cadastros";
import { perguntarProfessor, type Fonte } from "@/lib/professor.functions";

export const Route = createFileRoute("/_authenticated/professor")({
  head: () => ({
    meta: [
      { title: "Professor IA — Data5 Concursos" },
      { name: "description", content: "Tire dúvidas de concursos com um professor que responde com base na biblioteca de materiais." },
      { property: "og:title", content: "Professor IA" },
      { property: "og:description", content: "Tire dúvidas de concursos com um professor que responde com base na biblioteca de materiais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Professor,
});

type Msg = { role: "user" | "assistant"; content: string; fontes?: Fonte[] };

const SUGESTOES = [
  "Explique a diferença entre ato administrativo vinculado e discricionário.",
  "Quando ocorre crase e quando ela é proibida?",
  "Quais são os princípios expressos da Administração Pública?",
];

function Professor() {
  const { data } = useCadastros();
  const perguntar = useServerFn(perguntarProfessor);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [disciplinaId, setDisciplinaId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const enviar = async (pergunta: string) => {
    const p = pergunta.trim();
    if (!p || busy) return;
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: p }]);
    setTexto("");
    try {
      const r = await perguntar({
        data: {
          pergunta: p,
          historico: msgs.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          disciplina: data.disciplinas.find((d) => d.id === disciplinaId)?.nome ?? "",
        },
      });
      if (r.error) {
        toast.error(r.error);
        setMsgs((m) => m.slice(0, -1));
        setTexto(p);
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: r.resposta, fontes: r.fontes }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar(texto);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Professor IA</h1>
            <p className="text-sm text-muted-foreground">Tire dúvidas e receba a explicação fundamentada nos materiais da biblioteca.</p>
          </div>
          <select
            value={disciplinaId ?? ""}
            onChange={(e) => setDisciplinaId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-full border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Disciplina: qualquer</option>
            {data.disciplinas.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-4 rounded-2xl border bg-card p-4 shadow-soft">
          {msgs.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="google-stripe h-1 w-24 rounded-full" />
              <p className="max-w-md text-sm text-muted-foreground">
                Pergunte qualquer assunto de concurso. A resposta é buscada na biblioteca de materiais e fundamentada com a fonte usada.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => void enviar(s)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft"
                    : "max-w-[92%] rounded-2xl rounded-bl-sm border bg-background px-4 py-3 text-sm leading-relaxed shadow-soft"
                }
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.fontes && m.fontes.length > 0 && (
                  <div className="mt-3 border-t pt-2.5">
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Fontes usadas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.fontes.map((f) => (
                        <span key={f.titulo} title={f.trecho} className="rounded-full bg-g-blue/10 px-2.5 py-0.5 text-xs font-medium text-g-blue">
                          {f.titulo}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border bg-background px-4 py-3 text-sm text-muted-foreground shadow-soft">
                Pensando na resposta<span className="animate-pulse">...</span>
              </div>
            </div>
          )}
          <div ref={fim} />
        </div>

        <div className="mt-4 rounded-2xl border bg-card p-3 shadow-soft">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Escreva sua dúvida. Enter envia, Shift+Enter quebra linha."
            className="w-full resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              onClick={() => setMsgs([])}
              disabled={!msgs.length || busy}
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              Limpar conversa
            </button>
            <button
              onClick={() => void enviar(texto)}
              disabled={!texto.trim() || busy}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:shadow-lift hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Enviando..." : "Perguntar"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
