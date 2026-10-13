ALTER TABLE public.questions
  ADD COLUMN tipo text NOT NULL DEFAULT 'multipla_escolha'
  CHECK (tipo IN ('multipla_escolha', 'certo_errado'));

COMMENT ON COLUMN public.questions.tipo IS 'multipla_escolha (alternativas A-E) ou certo_errado (alternativas fixas: Certo, Errado)';