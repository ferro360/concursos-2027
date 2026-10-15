ALTER TABLE public.questions ADD COLUMN prova text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.questions.prova IS 'Nome do concurso/prova, ex.: INSS 2026 — Técnico do Seguro Social';