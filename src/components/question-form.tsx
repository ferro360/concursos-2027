import { useState } from "react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useCadastros, type CadastroTabela } from "@/hooks/use-cadastros";

export type QuestionInput = Pick<Tables<"questions">, "disciplina_id" | "assunto_id" | "banca_id" | "orgao_id" | "ano" | "enunciado" | "comentario" | "alternativas" | "correta"> & {
  disciplina: string; assunto: string; banca: string; orgao: string;
};

const letters = "ABCDE";
const NOVO = "__novo__";
const input = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function CadastroSelect({ label, value, options, onChange, onNovo, disabled }: {
  label: string; value: number | null; options: { id: number; nome: string }[];
  onChange: (id: number | null) => void; onNovo: () => void; disabled?: boolean;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-semibold">{label}</span>
      <select required disabled={disabled} value={value ?? ""} className={input}
        onChange={(e) => (e.target.value === NOVO ? onNovo() : onChange(e.target.value ? Number(e.target.value) : null))}>
        <option value="">{disabled ? "Escolha a disciplina primeiro" : "Selecione..."}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        <option value={NOVO}>+ Adicionar novo...</option>
      </select>
    </label>
  );
}

export function QuestionForm({ initial, submitLabel, onSubmit }: { initial?: Partial<QuestionInput> | undefined; submitLabel: string; onSubmit: (q: QuestionInput) => Promise<void> }) {
  const { data, adicionar } = useCadastros();
  const [ids, setIds] = useState({
    disciplina_id: initial?.disciplina_id ?? null, assunto_id: initial?.assunto_id ?? null,
    banca_id: initial?.banca_id ?? null, orgao_id: initial?.orgao_id ?? null,
  });
  const [form, setForm] = useState({
    ano: String(initial?.ano ?? new Date().getFullYear()), enunciado: initial?.enunciado ?? "", comentario: initial?.comentario ?? "",
  });
  const [alts, setAlts] = useState(() => [...(initial?.alternativas ?? []), "", "", "", "", ""].slice(0, 5));
  const [correta, setCorreta] = useState(initial?.correta ?? 0);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const novo = async (tabela: CadastroTabela, campo: keyof typeof ids, label: string) => {
    const nome = prompt(`Nome do novo(a) ${label}:`);
    if (!nome) return;
    const id = await adicionar(tabela, nome, ids.disciplina_id ?? undefined);
    if (id) setIds((s) => ({ ...s, [campo]: id, ...(campo === "disciplina_id" ? { assunto_id: null } : {}) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = alts.map((a) => a.trim());
    let last = filled.length - 1;
    while (last >= 0 && !filled[last]) last--;
    const alternativas = filled.slice(0, last + 1);
    if (Object.values(ids).some((v) => !v)) { toast.error("Selecione disciplina, assunto, banca e órgão."); return; }
    if (alternativas.length < 2 || alternativas.some((a) => !a)) { toast.error("Preencha ao menos 2 alternativas, em sequência."); return; }
    if (correta >= alternativas.length) { toast.error("A alternativa correta está vazia."); return; }
    setSaving(true);
    // names are filled in by the database from the linked records
    await onSubmit({ ...ids, ...form, disciplina: "", assunto: "", banca: "", orgao: "", ano: Number(form.ano), alternativas, correta });
    setSaving(false);
  };

  const assuntos = data.assuntos.filter((a) => a.disciplina_id === ids.disciplina_id);
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <CadastroSelect label="Disciplina" value={ids.disciplina_id} options={data.disciplinas}
          onChange={(v) => setIds({ ...ids, disciplina_id: v, assunto_id: null })} onNovo={() => novo("disciplinas", "disciplina_id", "disciplina")} />
        <CadastroSelect label="Assunto" value={ids.assunto_id} options={assuntos} disabled={!ids.disciplina_id}
          onChange={(v) => setIds({ ...ids, assunto_id: v })} onNovo={() => novo("assuntos", "assunto_id", "assunto")} />
        <CadastroSelect label="Banca" value={ids.banca_id} options={data.bancas}
          onChange={(v) => setIds({ ...ids, banca_id: v })} onNovo={() => novo("bancas", "banca_id", "banca")} />
        <CadastroSelect label="Órgão" value={ids.orgao_id} options={data.orgaos}
          onChange={(v) => setIds({ ...ids, orgao_id: v })} onNovo={() => novo("orgaos", "orgao_id", "órgão")} />
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Ano</span>
          <input required type="number" min={1950} max={2100} value={form.ano} onChange={set("ano")} className={input} />
        </label>
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
