import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SiteHeader } from "@/components/site-header";
import { QuestionForm } from "@/components/question-form";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Banco de Questões" },
      { name: "description", content: "Gerencie questões e usuários." },
      { property: "og:title", content: "Administração" },
      { property: "og:description", content: "Gerencie questões e usuários." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useIsAdmin();
  const [tab, setTab] = useState<"questoes" | "usuarios">("questoes");
  const tabCls = (t: string) => `rounded-md px-4 py-2 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`;
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl font-bold">Administração</h1>
        {loading ? <p>Carregando...</p> : !isAdmin ? (
          <p className="rounded-md bg-muted p-4">Acesso restrito a administradores.</p>
        ) : (
          <>
            <div className="mb-6 flex gap-2">
              <button className={tabCls("questoes")} onClick={() => setTab("questoes")}>Questões</button>
              <button className={tabCls("usuarios")} onClick={() => setTab("usuarios")}>Usuários</button>
            </div>
            {tab === "questoes" ? <Questoes /> : <Usuarios />}
          </>
        )}
      </main>
    </div>
  );
}

function Questoes() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Tables<"questions"> | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });
  const list = data.filter((q) => !busca || `${q.id} ${q.enunciado} ${q.disciplina} ${q.banca}`.toLowerCase().includes(busca.toLowerCase()));

  const excluir = async (id: number) => {
    if (!confirm(`Excluir a questão Q${id}? As respostas dela também serão apagadas.`)) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Questão excluída.");
    qc.invalidateQueries({ queryKey: ["questions"] });
  };

  if (editing) return (
    <div>
      <button onClick={() => setEditing(null)} className="mb-4 text-sm text-primary underline">← Voltar à lista</button>
      <h2 className="mb-4 font-display text-xl font-bold">Editar Q{editing.id}</h2>
      <QuestionForm initial={editing} submitLabel="Salvar alterações" onSubmit={async (q) => {
        const { error } = await supabase.from("questions").update(q).eq("id", editing.id);
        if (error) { toast.error("Erro ao salvar."); return; }
        toast.success("Questão atualizada.");
        qc.invalidateQueries({ queryKey: ["questions"] });
        setEditing(null);
      }} />
    </div>
  );

  return (
    <div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar questão..."
        className="mb-4 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr><th className="p-3">ID</th><th className="p-3">Enunciado</th><th className="p-3">Disciplina</th><th className="p-3">Banca / Ano</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {list.map((q) => (
              <tr key={q.id} className="border-t align-top">
                <td className="p-3 font-semibold">Q{q.id}</td>
                <td className="max-w-sm p-3"><span className="line-clamp-2">{q.enunciado}</span></td>
                <td className="p-3">{q.disciplina}</td>
                <td className="p-3">{q.banca} · {q.ano}</td>
                <td className="whitespace-nowrap p-3 text-right">
                  <button onClick={() => setEditing(q)} className="mr-3 text-primary underline">Editar</button>
                  <button onClick={() => excluir(q.id)} className="text-destructive underline">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Usuarios() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data = [], refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data;
    },
  });
  const done = (msg: string) => { toast.success(msg); refetch(); qc.invalidateQueries({ queryKey: ["ranking"] }); };

  const renomear = async (id: string, atual: string) => {
    const nome = prompt("Novo nome de usuário:", atual)?.trim();
    if (!nome || nome === atual) return;
    const { error } = await supabase.from("profiles").update({ username: nome }).eq("id", id);
    if (error) { toast.error("Erro ao renomear."); return; }
    done("Nome atualizado.");
  };
  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    const { error } = isAdmin
      ? await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
    if (error) { toast.error("Erro ao alterar permissão."); return; }
    done(isAdmin ? "Administrador removido." : "Agora é administrador.");
  };
  const zerar = async (id: string, nome: string) => {
    if (!confirm(`Apagar todas as respostas de ${nome}? Isso tira o usuário do ranking.`)) return;
    const { error } = await supabase.from("answers").delete().eq("user_id", id);
    if (error) { toast.error("Erro ao zerar."); return; }
    done("Respostas apagadas.");
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr><th className="p-3">Usuário</th><th className="p-3">E-mail</th><th className="p-3">Cadastro</th><th className="p-3 text-right">Resolvidas</th><th className="p-3 text-right">Acertos</th><th className="p-3 text-right">Questões criadas</th><th className="p-3"></th></tr>
        </thead>
        <tbody>
          {data.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-3 font-semibold">{u.username} {u.is_admin && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">admin</span>}</td>
              <td className="p-3">{u.email}</td>
              <td className="p-3">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
              <td className="p-3 text-right">{u.resolvidas}</td>
              <td className="p-3 text-right">{u.acertos}</td>
              <td className="p-3 text-right">{u.questoes}</td>
              <td className="whitespace-nowrap p-3 text-right">
                <button onClick={() => renomear(u.id, u.username)} className="mr-3 text-primary underline">Renomear</button>
                {u.id !== user?.id && (
                  <button onClick={() => toggleAdmin(u.id, u.is_admin)} className="mr-3 text-primary underline">{u.is_admin ? "Remover admin" : "Tornar admin"}</button>
                )}
                <button onClick={() => zerar(u.id, u.username)} className="text-destructive underline">Zerar respostas</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
