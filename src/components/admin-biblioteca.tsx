import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addKnowledgeDoc, deleteKnowledgeDoc } from "@/lib/knowledge.functions";

type Doc = { id: number; titulo: string; created_at: string; disciplinas: { nome: string } | null };

export function AdminBiblioteca() {
  const qc = useQueryClient();
  const salvarDoc = useServerFn(addKnowledgeDoc);
  const excluirDoc = useServerFn(deleteKnowledgeDoc);
  const [titulo, setTitulo] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: disciplinas = [] } = useQuery({
    queryKey: ["cadastros", "disciplinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("disciplinas").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["biblioteca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_docs")
        .select("id, titulo, created_at, disciplinas(nome)")
        .order("id", { ascending: false });
      if (error) throw error;
      return data as unknown as Doc[];
    },
  });

  const salvar = async () => {
    if (!titulo.trim() || conteudo.trim().length < 20) {
      toast.error("Informe o título e cole o conteúdo (mínimo 20 caracteres).");
      return;
    }
    setSalvando(true);
    const res = await salvarDoc({
      data: {
        titulo: titulo.trim(),
        disciplina_id: disciplinaId ? Number(disciplinaId) : null,
        conteudo,
      },
    });
    setSalvando(false);
    if (!res.ok) { toast.error(res.error ?? "Erro ao salvar."); return; }
    toast.success(`Material salvo e indexado em ${res.trechos} trecho(s).`);
    setTitulo(""); setDisciplinaId(""); setConteudo("");
    qc.invalidateQueries({ queryKey: ["biblioteca"] });
  };

  const excluir = async (doc: Doc) => {
    if (!confirm(`Excluir o material "${doc.titulo}" da base de conhecimento?`)) return;
    const res = await excluirDoc({ data: { id: doc.id } });
    if (!res.ok) { toast.error(res.error ?? "Erro ao excluir."); return; }
    toast.success("Material excluído.");
    qc.invalidateQueries({ queryKey: ["biblioteca"] });
  };

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Cole aqui leis, súmulas, apostilas, resumos ou editais. O conteúdo é dividido e indexado,
        e passa a alimentar o gerador e o comentador de questões com IA.
      </p>
      <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Título do material *</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Lei 8.112/90 — completa"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Disciplina (opcional)</label>
            <select value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
              <option value="">Geral (todas as disciplinas)</option>
              {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
        </div>
        <label className="mb-1 block text-sm font-medium">Conteúdo *</label>
        <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={8}
          placeholder="Cole aqui o texto do material (lei, apostila, resumo...)."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={salvar} disabled={salvando}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {salvando ? "Salvando e indexando..." : "Salvar e indexar"}
        </button>
        {salvando && <span className="ml-3 text-sm text-muted-foreground">Pode levar alguns segundos...</span>}
      </div>

      <h2 className="mb-3 font-display text-lg font-bold">Materiais cadastrados</h2>
      {docs.length === 0 ? (
        <p className="rounded-md bg-muted p-4 text-sm">Nenhum material ainda. Adicione o primeiro acima.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr><th className="p-3">Material</th><th className="p-3">Disciplina</th><th className="p-3">Cadastro</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-3 font-medium">{d.titulo}</td>
                  <td className="p-3">{d.disciplinas?.nome ?? "Geral"}</td>
                  <td className="p-3">{new Date(d.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-right"><button onClick={() => excluir(d)} className="text-destructive underline">Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
