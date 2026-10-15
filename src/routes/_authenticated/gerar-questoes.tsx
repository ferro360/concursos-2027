import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { useCadastros } from "@/hooks/use-cadastros";
import { gerarQuestoes, type QuestaoGerada } from "@/lib/ai-questions.functions";

export const Route = createFileRoute("/_authenticated/gerar-questoes")({
  head: () => ({
    meta: [
      { title: "Gerar questões com IA — Data5 Concursos" },
      { name: "description", content: "Gere questões de concurso com inteligência artificial e adicione ao banco." },
      { property: "og:title", content: "Gerar questões com IA" },
      { property: "og:description", content: "Gere questões de concurso com inteligência artificial e adicione ao banco." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GerarQuestoes,
});

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const letters = "ABCDE";
type Item = QuestaoGerada & { marcada: boolean };

function GerarQuestoes() {
  const { data } = useCadastros();
  const qc = useQueryClient();
  const gerar = useServerFn(gerarQuestoes);
  const [ids, setIds] = useState<{ disciplina: number | null; banca: number | null; orgao: number | null; nivel: number | null }>({ disciplina: null, banca: null, orgao: null, nivel: null });
  const [assuntoIds, setAssuntoIds] = useState<number[]>([]);
  const [tipo, setTipo] = useState<"multipla_escolha" | "certo_errado">("multipla_escolha");
  const [quantidade, setQuantidade] = useState(5);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [prova, setProva] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);

  const nome = (lista: { id: number; nome: string }[], id: number | null) => lista.find((x) => x.id === id)?.nome ?? "";
  const assuntos = data.assuntos.filter((a) => a.disciplina_id === ids.disciplina);

  const onGerar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ids.disciplina || !ids.banca || !ids.orgao) { toast.error("Selecione disciplina, banca e órgão."); return; }
    if (!assuntoIds.length && !instrucoes.trim() && !conteudo.trim()) { toast.error("Marque um assunto, cole um conteúdo ou descreva o tema nas instruções."); return; }
    setBusy(true);
    try {
      const r = await gerar({ data: {
        disciplina: nome(data.disciplinas, ids.disciplina),
        assuntos: assuntoIds.map((id) => nome(data.assuntos, id)),
        banca: nome(data.bancas, ids.banca), nivel: nome(data.niveis, ids.nivel),
        tipo, quantidade, instrucoes, conteudo: conteudo.trim(),
      } });
      if (r.error) toast.error(r.error);
      else { setItens(r.questoes.map((q) => ({ ...q, marcada: true }))); toast.success(`${r.questoes.length} questão(ões) geradas. Revise antes de salvar.`); }
    } catch { toast.error("Não foi possível gerar as questões agora."); }
    setBusy(false);
  };

  const upd = (i: number, p: Partial<Item>) => setItens((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const salvar = async () => {
    const sel = itens.filter((q) => q.marcada);
    if (!sel.length) { toast.error("Marque ao menos uma questão."); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    let ok = 0;
    for (const q of sel) {
      const { data: created, error } = await supabase.from("questions").insert({
        disciplina_id: ids.disciplina!, assunto_id: assuntoIds[0] ?? null, banca_id: ids.banca!, orgao_id: ids.orgao!, nivel_id: ids.nivel,
        disciplina: "", assunto: "", banca: "", orgao: "", nivel: "",
        ano, tipo, prova: prova.trim(), enunciado: q.enunciado.trim(), alternativas: q.alternativas, correta: q.correta, comentario: q.comentario.trim(),
        created_by: u.user!.id,
      }).select("id").single();
      if (error) continue;
      if (assuntoIds.length) await supabase.from("question_assuntos").insert(assuntoIds.map((assunto_id) => ({ question_id: created.id, assunto_id })));
      ok++;
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["questions"] });
    qc.invalidateQueries({ queryKey: ["question-assuntos"] });
    if (ok) toast.success(`${ok} questão(ões) adicionadas ao banco!`);
    if (ok < sel.length) toast.error(`${sel.length - ok} não puderam ser salvas.`);
    setItens((s) => s.filter((q) => !q.marcada));
  };

  const sel = (label: string, value: number | null, options: { id: number; nome: string }[], onChange: (v: number | null) => void, opcional?: boolean) => (
    <label className="space-y-1 text-sm">
      <span className="font-semibold">{label}{opcional && <span className="font-normal text-muted-foreground"> (opcional)</span>}</span>
      <select value={value ?? ""} className={input} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Selecione...</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
    </label>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 font-display text-3xl font-bold">Gerar questões com IA</h1>
        <p className="mb-6 text-sm text-muted-foreground">Escolha o tema, gere, revise e salve. Só entram no banco as questões que você marcar.</p>
        <form onSubmit={onGerar} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {sel("Disciplina", ids.disciplina, data.disciplinas, (v) => { setIds({ ...ids, disciplina: v }); setAssuntoIds([]); })}
            {sel("Banca (estilo)", ids.banca, data.bancas, (v) => setIds({ ...ids, banca: v }))}
            {sel("Órgão", ids.orgao, data.orgaos, (v) => setIds({ ...ids, orgao: v }))}
            {sel("Escolaridade / Nível", ids.nivel, data.niveis, (v) => setIds({ ...ids, nivel: v }), true)}
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Tipo</span>
              <select value={tipo} className={input} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
                <option value="multipla_escolha">Múltipla escolha (A–E)</option>
                <option value="certo_errado">Certo ou Errado</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="font-semibold">Quantidade</span>
                <input type="number" min={1} max={10} value={quantidade} onChange={(e) => setQuantidade(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} className={input} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold">Ano</span>
                <input type="number" min={1950} max={2100} value={ano} onChange={(e) => setAno(Number(e.target.value))} className={input} />
              </label>
            </div>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-semibold">Concurso / Prova <span className="font-normal text-muted-foreground">(opcional — ex.: INSS 2026 — Técnico; vale para todas as questões salvas)</span></span>
              <input placeholder="Nome do concurso ou prova" value={prova} onChange={(e) => setProva(e.target.value)} className={input} />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Assuntos <span className="font-normal text-muted-foreground">(opcional — se não marcar, descreva o tema nas instruções)</span></legend>
            {!ids.disciplina ? <p className="text-sm text-muted-foreground">Escolha a disciplina primeiro.</p> : (
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {assuntos.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={assuntoIds.includes(a.id)}
                      onChange={() => setAssuntoIds((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))} />
                    {a.nome}
                  </label>
                ))}
                {!assuntos.length && <p className="text-sm text-muted-foreground">Nenhum assunto cadastrado nessa disciplina.</p>}
              </div>
            )}
          </fieldset>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold">Conteúdo base <span className="font-normal text-muted-foreground">(opcional — cole um texto, lei, apostila; as questões serão criadas a partir dele)</span></span>
            <textarea rows={8} maxLength={60000} placeholder="Cole aqui o conteúdo..." value={conteudo} onChange={(e) => setConteudo(e.target.value)} className={input} />
            <span className="text-xs text-muted-foreground">{conteudo.length.toLocaleString("pt-BR")} / 60.000 caracteres</span>
          </label>
          <textarea rows={2} maxLength={2000} placeholder="Instruções — ex.: tema/assunto que servirá de base (quando não estiver cadastrado), foco em jurisprudência do STF, nível difícil..." value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} className={input} />
          <button disabled={busy} className="rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground shadow-soft transition hover:shadow-lift disabled:opacity-50">
            {busy ? "Gerando... (pode levar até 1 minuto)" : "Gerar questões"}
          </button>
        </form>

        {itens.length > 0 && (
          <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Revisão ({itens.filter((q) => q.marcada).length} marcadas)</h2>
              <button onClick={salvar} disabled={saving} className="rounded-md bg-primary px-5 py-2 font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? "Salvando..." : "Adicionar ao banco"}
              </button>
            </div>
            {itens.map((q, i) => (
              <article key={i} className={`space-y-3 rounded-xl border bg-card p-5 shadow-sm ${q.marcada ? "" : "opacity-50"}`}>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={q.marcada} onChange={() => upd(i, { marcada: !q.marcada })} /> Questão {i + 1}
                </label>
                <textarea rows={4} value={q.enunciado} onChange={(e) => upd(i, { enunciado: e.target.value })} className={input} />
                {q.alternativas.map((a, k) => (
                  <label key={k} className="flex items-center gap-3">
                    <input type="radio" name={`c${i}`} checked={q.correta === k} onChange={() => upd(i, { correta: k })} />
                    {tipo === "certo_errado" ? <span className="font-semibold">{a}</span> : (<>
                      <span className="w-4 font-semibold">{letters[k]}</span>
                      <input value={a} onChange={(e) => upd(i, { alternativas: q.alternativas.map((x, j) => (j === k ? e.target.value : x)) })} className={input} />
                    </>)}
                  </label>
                ))}
                <textarea rows={3} value={q.comentario} onChange={(e) => upd(i, { comentario: e.target.value })} className={input} />
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
