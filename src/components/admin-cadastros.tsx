import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCadastros, type CadastroTabela } from "@/hooks/use-cadastros";

const TABS: [CadastroTabela, string][] = [["disciplinas", "Disciplinas"], ["assuntos", "Assuntos"], ["bancas", "Bancas"], ["orgaos", "Órgãos"], ["niveis", "Níveis"]];

export function AdminCadastros() {
  const { data, adicionar, refresh } = useCadastros();
  const [tab, setTab] = useState<CadastroTabela>("disciplinas");
  const [nome, setNome] = useState("");
  const [discId, setDiscId] = useState<number | "">("");

  const nomeDisc = (id: number) => data.disciplinas.find((d) => d.id === id)?.nome ?? "";
  const itens = tab === "assuntos"
    ? data.assuntos.filter((a) => !discId || a.disciplina_id === discId)
    : data[tab];

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "assuntos" && !discId) { toast.error("Escolha a disciplina do assunto."); return; }
    if (await adicionar(tab, nome, discId || undefined)) { setNome(""); toast.success("Cadastrado."); }
  };
  const renomear = async (id: number, atual: string) => {
    const n = prompt("Novo nome:", atual)?.trim();
    if (!n || n === atual) return;
    const { error } = await supabase.from(tab).update({ nome: n }).eq("id", id);
    if (error) { toast.error(error.code === "23505" ? "Esse nome já existe." : "Erro ao renomear."); return; }
    toast.success("Renomeado. As questões vinculadas foram atualizadas.");
    refresh();
  };
  const excluir = async (id: number, n: string) => {
    if (!confirm(`Excluir "${n}"?`)) return;
    const { error } = await supabase.from(tab).delete().eq("id", id);
    if (error) { toast.error(error.code === "23503" ? "Não dá para excluir: há questões vinculadas." : "Erro ao excluir."); return; }
    toast.success("Excluído.");
    refresh();
  };

  const input = "rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-sm ${tab === t ? "border-primary bg-primary/10 font-semibold" : ""}`}>
            {l} ({data[t].length})
          </button>
        ))}
      </div>
      <form onSubmit={add} className="mb-4 flex flex-wrap gap-2">
        {tab === "assuntos" && (
          <select value={discId} onChange={(e) => setDiscId(e.target.value ? Number(e.target.value) : "")} className={input}>
            <option value="">Todas as disciplinas</option>
            {data.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        )}
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Novo nome..." className={`${input} flex-1`} />
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Adicionar</button>
      </form>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className="border-t first:border-t-0">
                <td className="p-3 font-semibold">{i.nome}</td>
                {tab === "assuntos" && <td className="p-3 text-muted-foreground">{"disciplina_id" in i ? nomeDisc(Number(i.disciplina_id)) : ""}</td>}
                <td className="whitespace-nowrap p-3 text-right">
                  <button onClick={() => renomear(i.id, i.nome)} className="mr-3 text-primary underline">Renomear</button>
                  <button onClick={() => excluir(i.id, i.nome)} className="text-destructive underline">Excluir</button>
                </td>
              </tr>
            ))}
            {itens.length === 0 && <tr><td className="p-6 text-center text-muted-foreground">Nada cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
