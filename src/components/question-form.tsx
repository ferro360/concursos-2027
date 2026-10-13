import { useState } from "react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type QuestionInput = Pick<Tables<"questions">, "disciplina" | "assunto" | "banca" | "orgao" | "ano" | "enunciado" | "comentario" | "alternativas" | "correta">;

const letters = "ABCDE";

export function QuestionForm({ initial, submitLabel, onSubmit }: { initial?: QuestionInput | undefined; submitLabel: string; onSubmit: (q: QuestionInput) => Promise<void> }) {
  const [form, setForm] = useState({
    disciplina: initial?.disciplina ?? "", assunto: initial?.assunto ?? "", banca: initial?.banca ?? "", orgao: initial?.orgao ?? "",
    ano: String(initial?.ano ?? new Date().getFullYear()), enunciado: initial?.enunciado ?? "", comentario: initial?.comentario ?? "",
  });
  const [alts, setAlts] = useState(() => [...(initial?.alternativas ?? []), "", "", "", "", ""].slice(0, 5));
  const [correta, setCorreta] = useState(initial?.correta ?? 0);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = alts.map((a) => a.trim());
    let last = filled.length - 1;
    while (last >= 0 && !filled[last]) last--;
    const alternativas = filled.slice(0, last + 1);
    if (alternativas.length < 2 || alternativas.some((a) => !a)) { toast.error("Preencha ao menos 2 alternativas, em sequência."); return; }
    if (correta >= alternativas.length) { toast.error("A alternativa correta está vazia."); return; }
    setSaving(true);
    await onSubmit({ ...form, ano: Number(form.ano), alternativas, correta });
    setSaving(false);
  };

  const input = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
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
        {saving ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
