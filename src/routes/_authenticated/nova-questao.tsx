import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { QuestionForm } from "@/components/question-form";
import { SpreadsheetImport } from "@/components/spreadsheet-import";

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

function NovaQuestao() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl font-bold">Nova questão</h1>
        <SpreadsheetImport />
        <QuestionForm submitLabel="Cadastrar questão" onSubmit={async (q) => {
          const { data: u } = await supabase.auth.getUser();
          const { assunto_ids, ...rest } = q;
          const { data: created, error } = await supabase.from("questions").insert({ ...rest, created_by: u.user!.id }).select("id").single();
          if (error) { toast.error("Erro ao salvar a questão."); return; }
          const { error: linkError } = await supabase.from("question_assuntos")
            .insert(assunto_ids.map((assunto_id) => ({ question_id: created.id, assunto_id })));
          if (linkError) { toast.error("Questão salva, mas houve erro ao vincular os assuntos."); return; }
          toast.success("Questão cadastrada!");
          qc.invalidateQueries({ queryKey: ["questions"] });
          qc.invalidateQueries({ queryKey: ["question-assuntos"] });
          navigate({ to: "/" });
        }} />
      </main>
    </div>
  );
}
