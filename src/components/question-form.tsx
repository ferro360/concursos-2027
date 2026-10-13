import { useState } from "react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useCadastros, type CadastroTabela } from "@/hooks/use-cadastros";

export type QuestionInput = Pick<Tables<"questions">, "disciplina_id" | "assunto_id" | "banca_id" | "orgao_id" | "ano" | "tipo" | "enunciado" | "comentario" | "alternativas" | "correta" | "imagem_url" | "video_url"> & {
  disciplina: string; assunto: string; banca: string; orgao: string;
  /** todos os assuntos marcados (inclui o principal, assunto_id) */
  assunto_ids: number[];
};

const letters = "ABCDE";
const CE = ["Certo", "Errado"];
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
    disciplina_id: initial?.disciplina_id ?? null,
    banca_id: initial?.banca_id ?? null, orgao_id: initial?.orgao_id ?? null,
  });
  const [assuntoIds, setAssuntoIds] = useState<number[]>(
    initial?.assunto_ids ?? (initial?.assunto_id ? [initial.assunto_id] : [])
  );
  const [form, setForm] = useState({
    ano: String(initial?.ano ?? new Date().getFullYear()), enunciado: initial?.enunciado ?? "", comentario: initial?.comentario ?? "",
    imagem_url: initial?.imagem_url ?? "", video_url: initial?.video_url ?? "",
  });
  const [tipo, setTipo] = useState<"multipla_escolha" | "certo_errado">(initial?.tipo === "certo_errado" ? "certo_errado" : "multipla_escolha");
  const [alts, setAlts] = useState(() => [...(initial?.alternativas ?? []), "", "", "", "", ""].slice(0, 5));
  const [correta, setCorreta] = useState(initial?.correta ?? 0);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const toggleAssunto = (id: number) =>
    setAssuntoIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const novo = async (tabela: CadastroTabela, campo: keyof typeof ids, label: string) => {
    const nome = prompt(`Nome do novo(a) ${label}:`);
    if (!nome) return;
    const id = await adicionar(tabela, nome, ids.disciplina_id ?? undefined);
    if (id) setIds((s) => ({ ...s, [campo]: id }));
  };

  const novoAssunto = async () => {
    if (!ids.disciplina_id) { toast.error("Escolha a disciplina primeiro."); return; }
    const nome = prompt("Nome do novo assunto:");
    if (!nome) return;
    const id = await adicionar("assuntos", nome, ids.disciplina_id);
    if (id) setAssuntoIds((s) => [...s, id]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = alts.map((a) => a.trim());
    let last = filled.length - 1;
    while (last >= 0 && !filled[last]) last--;
    const alternativas = tipo === "certo_errado" ? CE : filled.slice(0, last + 1);
    if (!ids.disciplina_id || !ids.banca_id || !ids.orgao_id) { toast.error("Selecione disciplina, banca e órgão."); return; }
    if (assuntoIds.length === 0) { toast.error("Marque ao menos um assunto."); return; }
    if (tipo === "multipla_escolha" && (alternativas.length < 2 || alternativas.some((a) => !a))) { toast.error("Preencha ao menos 2 alternativas, em sequência."); return; }
    if (correta >= alternativas.length) { toast.error("Marque a resposta correta."); return; }
    setSaving(true);
    // names are filled in by the database from the linked records
    await onSubmit({
      ...ids, ...form, assunto_id: assuntoIds[0] ?? null, assunto_ids: assuntoIds,
      disciplina: "", assunto: "", banca: "", orgao: "", ano: Number(form.ano), tipo, alternativas, correta,
    });
    setSaving(false);
  };

  const assuntos = data.assuntos.filter((a) => a.disciplina_id === ids.disciplina_id);
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <CadastroSelect label="Disciplina" value={ids.disciplina_id} options={data.disciplinas}
          onChange={(v) => { setIds({ ...ids, disciplina_id: v }); setAssuntoIds([]); }} onNovo={() => novo("disciplinas", "disciplina_id", "disciplina")} />
        <CadastroSelect label="Banca" value={ids.banca_id} options={data.bancas}
          onChange={(v) => setIds({ ...ids, banca_id: v })} onNovo={() => novo("bancas", "banca_id", "banca")} />
        <CadastroSelect label="Órgão" value={ids.orgao_id} options={data.orgaos}
          onChange={(v) => setIds({ ...ids, orgao_id: v })} onNovo={() => novo("orgaos", "orgao_id", "órgão")} />
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Ano</span>
          <input required type="number" min={1950} max={2100} value={form.ano} onChange={set("ano")} className={input} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Tipo</span>
          <select value={tipo} className={input} onChange={(e) => {
            const t = e.target.value as "multipla_escolha" | "certo_errado";
            setTipo(t); setCorreta(0); setAlts(["", "", "", "", ""]);
          }}>
            <option value="multipla_escolha">Múltipla escolha (A–E)</option>
            <option value="certo_errado">Certo ou Errado</option>
          </select>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">
          Assuntos <span className="font-normal text-muted-foreground">(marque um ou mais; o primeiro marcado é o principal)</span>
        </legend>
        {!ids.disciplina_id ? (
          <p className="text-sm text-muted-foreground">Escolha a disciplina primeiro.</p>
        ) : (
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
            {assuntos.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={assuntoIds.includes(a.id)} onChange={() => toggleAssunto(a.id)} />
                {a.nome}
              </label>
            ))}
            <button type="button" onClick={novoAssunto} className="text-left text-sm text-primary underline">
              + Adicionar novo assunto...
            </button>
          </div>
        )}
      </fieldset>

      <textarea required rows={4} placeholder="Enunciado" value={form.enunciado} onChange={set("enunciado")} className={input} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Imagem <span className="font-normal text-muted-foreground">(opcional — link da imagem)</span></span>
          <input type="url" placeholder="https://..." value={form.imagem_url} onChange={set("imagem_url")} className={input} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Vídeo <span className="font-normal text-muted-foreground">(opcional — link do YouTube)</span></span>
          <input type="url" placeholder="https://www.youtube.com/watch?v=..." value={form.video_url} onChange={set("video_url")} className={input} />
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">
          {tipo === "certo_errado" ? "Gabarito" : "Alternativas"} <span className="font-normal text-muted-foreground">(marque a correta)</span>
        </p>
        {tipo === "certo_errado" ? CE.map((nome, i) => (
          <label key={nome} className="flex items-center gap-3">
            <input type="radio" name="correta" checked={correta === i} onChange={() => setCorreta(i)} />
            <span className="font-semibold">{nome}</span>
          </label>
        )) : alts.map((a, i) => (
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
