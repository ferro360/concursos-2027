import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { statusIA } from "@/lib/ia-config.functions";

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Status({ ok, label, detalhe }: { ok: boolean; label: string; detalhe: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-success" : "bg-muted-foreground/40"}`} />
      <div>
        <p className="text-sm font-semibold">{label}: {ok ? "disponível" : "não configurado"}</p>
        <p className="text-xs text-muted-foreground">{detalhe}</p>
      </div>
    </div>
  );
}

export function AdminIA() {
  const qc = useQueryClient();
  const status = useServerFn(statusIA);
  const { data: chaves } = useQuery({ queryKey: ["ia-status"], queryFn: async () => (await status()).chaves ?? null });
  const { data: config } = useQuery({
    queryKey: ["ia-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ia_config").select("provedor, plano_b, openrouter_modelo").single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ provedor: "lovable", plano_b: true, openrouter_modelo: "" });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (config) setForm(config); }, [config]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from("ia_config")
      .update({ ...form, openrouter_modelo: form.openrouter_modelo.trim(), atualizado_em: new Date().toISOString() })
      .eq("id", 1);
    setSalvando(false);
    if (error) { toast.error("Erro ao salvar a configuração."); return; }
    toast.success("Configuração da IA salva.");
    qc.invalidateQueries({ queryKey: ["ia-config"] });
  };

  const principalSemChave = chaves && (form.provedor === "openrouter" ? !chaves.openrouter : !chaves.lovable);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">Provedores</h2>
        {!chaves ? <p className="text-sm text-muted-foreground">Verificando...</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Status ok={chaves.lovable} label="IA do Lovable"
              detalhe="Usa os créditos do workspace do Lovable. Só existe quando o app roda no Lovable." />
            <Status ok={chaves.openrouter} label="OpenRouter"
              detalhe="Chave OPENROUTER_API_KEY nos Secrets do Lovable (Cloud → Secrets) ou nas variáveis da Vercel." />
          </div>
        )}
      </section>

      <form onSubmit={salvar} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">IA principal</span>
          <select value={form.provedor} onChange={(e) => setForm({ ...form, provedor: e.target.value })} className={input}>
            <option value="lovable">Lovable (créditos do workspace)</option>
            <option value="openrouter">OpenRouter (API externa)</option>
          </select>
          {principalSemChave && (
            <span className="block text-xs text-destructive">Essa IA não está configurada neste servidor; o app vai usar a outra, se houver.</span>
          )}
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={form.plano_b} onChange={(e) => setForm({ ...form, plano_b: e.target.checked })} />
          <span>
            <span className="font-semibold">Plano B automático</span>
            <span className="block text-xs text-muted-foreground">Se a IA principal falhar (créditos esgotados, limite de uso, fora do ar), tenta a outra.</span>
          </span>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Modelo do OpenRouter</span>
          <input value={form.openrouter_modelo} onChange={(e) => setForm({ ...form, openrouter_modelo: e.target.value })}
            placeholder={chaves?.openrouterModeloPadrao ?? "ex.: anthropic/claude-sonnet-5.5"} className={input} />
          <span className="block text-xs text-muted-foreground">
            Nome do modelo como aparece em openrouter.ai/models. Vazio usa o padrão{chaves ? ` (${chaves.openrouterModeloPadrao})` : ""}.
          </span>
        </label>

        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          A biblioteca de conhecimento usa sempre a IA do Lovable para a busca, porque o material foi indexado com ela.
          {chaves && !chaves.lovable && !chaves.openrouterEmbeddings && " Neste servidor ela está desligada (sem IA do Lovable)."}
        </p>

        <button disabled={salvando || !config} className="rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}
