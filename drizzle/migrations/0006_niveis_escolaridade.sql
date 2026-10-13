CREATE TABLE public.niveis (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.niveis TO anon;
GRANT SELECT, INSERT ON public.niveis TO authenticated;
GRANT ALL ON public.niveis TO service_role;

ALTER TABLE public.niveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON public.niveis FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth insert" ON public.niveis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin update" ON public.niveis FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin delete" ON public.niveis FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.questions ADD COLUMN nivel_id bigint REFERENCES public.niveis(id) ON DELETE RESTRICT;
ALTER TABLE public.questions ADD COLUMN nivel text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.sync_question_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT nome INTO NEW.disciplina FROM public.disciplinas WHERE id = NEW.disciplina_id;
  SELECT nome INTO NEW.assunto FROM public.assuntos WHERE id = NEW.assunto_id;
  SELECT nome INTO NEW.banca FROM public.bancas WHERE id = NEW.banca_id;
  SELECT nome INTO NEW.orgao FROM public.orgaos WHERE id = NEW.orgao_id;
  IF NEW.nivel_id IS NOT NULL THEN
    SELECT nome INTO NEW.nivel FROM public.niveis WHERE id = NEW.nivel_id;
  ELSE
    NEW.nivel := '';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_nivel_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.questions SET nivel = NEW.nome WHERE nivel_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER niveis_rename AFTER UPDATE OF nome ON public.niveis
FOR EACH ROW EXECUTE FUNCTION public.propagate_nivel_rename();

INSERT INTO public.niveis (nome) VALUES
  ('Fundamental'),
  ('Médio'),
  ('Médio/Técnico'),
  ('Superior');