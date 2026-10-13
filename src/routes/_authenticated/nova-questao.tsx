import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/_authenticated/nova-questao")({
  head: () => ({
    meta: [
      { title: "Nova questão — Banco de Questões" },
      { name: "description", content: "Cadastre uma nova questão de concurso." },
      { property: "og:title", content: "Nova questão" },
      { property: "og:description", content: "Cadastre uma nova questão de concurso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovaQuestao,
});

const letters = "ABCDE";

function NovaQuestao() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ disciplina: "", assunto: "", banca: "", orgao: "", ano: String(new Date().getFullYear()), enunciado: "", comentario: "" });
  const [alts, setAlts] = useState(["", "", "", "", ""]);
  const [correta, setCorreta] = useState(0);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = alts.map((a) => a.trim());
    const last = filled.findLastIndex((a) => a);
    const alternativas = filled.slice(0, last + 1);
    if (alternativas.length < 2 || alternativas.some((a) => !a)) return toast.error("Preencha ao menos 2 alternativas, em sequência.");
    if (correta >= alternativas.length) return toast.error("A alternativa correta está vazia.");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("questions").insert({
      ...form, ano: Number(form.ano), alternativas, correta, created_by: u.user!.id,
    });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar a questão.");
    toast.success("Questão cadastrada!");
    qc.invalidateQueries({ queryKey: ["questions"] });
    navigate({ to: "/" });
  };

  const input = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl font-bold">Nova questão</h1>
        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required placeholder="Disciplina" value={form.disciplina} onChange={set("disciplina")} className={input} />
            <input required placeholder="Assunto" value={form.assunto} onChange={set("assunto")} className={input} />
            <input required placeholder="Banca" value={form.banca} onChange={set("banca")} className={input} />
            <input required placeholder="Órgão" value={form.orgao} onChange={set("orgao")} className={input} />
            <input required type="number" min={1950} max={2100} placeholder="Ano" value={form.ano} onChange={set("ano")} className={input} />
          </div>
          <textarea required rows={4} placeholder="Enunciado" value={form.enunciado} onChange={set("enunciado")} className={input} />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Alternativas <span className="font-normal text-muted-foreground">(marque a correta)</span></p>
            {alts.map((a, i) => (
              <label key={i} className="flex items-center gap-3">
                <input type="radio" name="correta" checked={correta === i} onChange={() => setCorreta(i)} />
                <span className="w-4 font-semibold">{letters[i]}</span>
                <input value={a} onChange={(e) => setAlts(alts.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={i < 2 ? "Obrigatória" : "Opcional"} className={input} />
              </label>
            ))}
          </div>
          <textarea rows={3} placeholder="Comentário / explicação (opcional)" value={form.comentario} onChange={set("comentario")} className={input} />
          <button disabled={saving} className="rounded-md bg-accent px-6 py-2 font-semibold text-accent-foreground disabled:opacity-50">
            {saving ? "Salvando..." : "Cadastrar questão"}
          </button>
        </form>
      </main>
    </div>
  );
}
