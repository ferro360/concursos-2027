CREATE TABLE public.question_assuntos (
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  assunto_id bigint NOT NULL REFERENCES public.assuntos(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, assunto_id)
);

INSERT INTO public.question_assuntos (question_id, assunto_id)
SELECT id, assunto_id FROM public.questions WHERE assunto_id IS NOT NULL;

GRANT SELECT ON public.question_assuntos TO anon;
GRANT SELECT, INSERT, DELETE ON public.question_assuntos TO authenticated;
GRANT ALL ON public.question_assuntos TO service_role;

ALTER TABLE public.question_assuntos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa public read" ON public.question_assuntos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qa owner insert" ON public.question_assuntos FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "qa owner delete" ON public.question_assuntos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND (q.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

COMMENT ON COLUMN public.questions.assunto_id IS 'Assunto principal; assuntos adicionais em question_assuntos';