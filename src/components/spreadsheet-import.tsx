import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const COLS = ["disciplina", "assuntos", "banca", "orgao", "ano", "enunciado", "A", "B", "C", "D", "E", "correta", "comentario", "imagem_url", "video_url"];
const norm = (s: unknown) => String(s ?? "").trim();
const key = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function SpreadsheetImport() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const modelo = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([COLS, ["Português", "Crase; Concordância", "CESPE", "TCU", 2024, "Assinale a alternativa correta.", "Opção 1", "Opção 2", "Opção 3", "Opção 4", "", "B", "Explicação...", "", ""]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questoes");
    XLSX.writeFile(wb, "modelo-questoes.xlsx");
  };

  const importar = async (file: File) => {
    setBusy(true); setLog([]);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, { defval: "" });
    type Row = Record<"disciplina" | "assuntos" | "assunto" | "banca" | "orgao" | "ano" | "enunciado" | "a" | "b" | "c" | "d" | "e" | "correta" | "comentario" | "imagem_url" | "video_url", string>;
    const rows = raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [key(k.trim()), norm(v)])) as Row);
    const { data: u } = await supabase.auth.getUser();
    const cache = new Map<string, number>();
    const getId = async (tabela: "disciplinas" | "bancas" | "orgaos" | "assuntos", nome: string, disciplina_id?: number) => {
      const ck = `${tabela}|${disciplina_id ?? ""}|${key(nome)}`;
      if (cache.has(ck)) return cache.get(ck)!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from(tabela).select("id").ilike("nome", nome);
      if (tabela === "assuntos") q = q.eq("disciplina_id", disciplina_id!);
      const { data } = await q.limit(1);
      let id = data?.[0]?.id as number | undefined;
      if (!id) {
        const ins = tabela === "assuntos"
          ? await supabase.from("assuntos").insert({ nome, disciplina_id: disciplina_id! }).select("id").single()
          : await supabase.from(tabela).insert({ nome }).select("id").single();
        if (ins.error) throw new Error(`não foi possível cadastrar ${tabela.slice(0, -1)} "${nome}"`);
        id = ins.data.id;
      }
      cache.set(ck, id);
      return id;
    };

    const msgs: string[] = []; let ok = 0;
    for (const [i, r] of rows.entries()) {
      const linha = i + 2;
      try {
        const alternativas = ["a", "b", "c", "d", "e"].map((l) => r[l as keyof Row]).filter(Boolean);
        const letra = (r.correta ?? "").toUpperCase();
        const correta = /^[A-E]$/.test(letra) ? letra.charCodeAt(0) - 65 : Number(letra) - 1;
        const assuntos = (r.assuntos || r.assunto || "").split(/[;|]/).map((s) => s.trim()).filter(Boolean);
        if (!r.disciplina || !r.banca || !r.orgao || !r.enunciado || !assuntos.length) throw new Error("faltam campos obrigatórios");
        if (alternativas.length < 2) throw new Error("mínimo de 2 alternativas");
        if (!(correta >= 0 && correta < alternativas.length)) throw new Error("resposta correta inválida");
        const disciplina_id = await getId("disciplinas", r.disciplina);
        const assunto_ids: number[] = [];
        for (const a of assuntos) assunto_ids.push(await getId("assuntos", a, disciplina_id));
        const banca_id = await getId("bancas", r.banca);
        const orgao_id = await getId("orgaos", r.orgao);
        const { data: created, error } = await supabase.from("questions").insert({
          disciplina_id, assunto_id: assunto_ids[0]!, banca_id, orgao_id,
          disciplina: r.disciplina, assunto: assuntos[0]!, banca: r.banca, orgao: r.orgao,
          ano: Number(r.ano) || new Date().getFullYear(), enunciado: r.enunciado, alternativas, correta,
          ...(r.comentario ? { comentario: r.comentario } : {}), ...(r.imagem_url ? { imagem_url: r.imagem_url } : {}), ...(r.video_url ? { video_url: r.video_url } : {}),
          created_by: u.user!.id,
        }).select("id").single();
        if (error) throw new Error("erro ao salvar");
        await supabase.from("question_assuntos").insert([...new Set(assunto_ids)].map((assunto_id) => ({ question_id: created.id, assunto_id })));
        ok++;
      } catch (e) {
        msgs.push(`Linha ${linha}: ${(e as Error).message}`);
      }
    }
    setLog(msgs); setBusy(false);
    ["questions", "question-assuntos", "cadastros"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    if (ok) toast.success(`${ok} questão(ões) importada(s).`);
    if (msgs.length) toast.error(`${msgs.length} linha(s) com erro.`);
  };

  return (
    <section className="mb-8 rounded-lg border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Importar planilha</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Envie um arquivo .xlsx ou .csv com as colunas do modelo. Vários assuntos separados por ";". Disciplinas, assuntos, bancas e órgãos novos são cadastrados automaticamente.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={modelo} className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted">Baixar modelo</button>
        <label className="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          {busy ? "Importando..." : "Enviar planilha"}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importar(f); }} />
        </label>
      </div>
      {log.length > 0 && (
        <ul className="mt-4 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs text-destructive">
          {log.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </section>
  );
}
