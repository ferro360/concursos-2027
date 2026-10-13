CREATE TABLE public.disciplinas (id bigserial PRIMARY KEY, nome text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.assuntos (id bigserial PRIMARY KEY, disciplina_id bigint NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE, nome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (disciplina_id, nome));
CREATE TABLE public.bancas (id bigserial PRIMARY KEY, nome text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.orgaos (id bigserial PRIMARY KEY, nome text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['disciplinas','assuntos','bancas','orgaos'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT USAGE ON SEQUENCE public.%I TO authenticated', t || '_id_seq');
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "public read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "auth insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "admin update" ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t);
    EXECUTE format('CREATE POLICY "admin delete" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;

ALTER TABLE public.questions
  ADD COLUMN disciplina_id bigint REFERENCES public.disciplinas(id) ON DELETE RESTRICT,
  ADD COLUMN assunto_id bigint REFERENCES public.assuntos(id) ON DELETE RESTRICT,
  ADD COLUMN banca_id bigint REFERENCES public.bancas(id) ON DELETE RESTRICT,
  ADD COLUMN orgao_id bigint REFERENCES public.orgaos(id) ON DELETE RESTRICT;

INSERT INTO public.disciplinas (nome) SELECT DISTINCT disciplina FROM public.questions;
INSERT INTO public.bancas (nome) SELECT DISTINCT banca FROM public.questions;
INSERT INTO public.orgaos (nome) SELECT DISTINCT orgao FROM public.questions;
INSERT INTO public.assuntos (disciplina_id, nome) SELECT DISTINCT d.id, q.assunto FROM public.questions q JOIN public.disciplinas d ON d.nome = q.disciplina;
UPDATE public.questions q SET
  disciplina_id = (SELECT id FROM public.disciplinas WHERE nome = q.disciplina),
  banca_id = (SELECT id FROM public.bancas WHERE nome = q.banca),
  orgao_id = (SELECT id FROM public.orgaos WHERE nome = q.orgao),
  assunto_id = (SELECT a.id FROM public.assuntos a JOIN public.disciplinas d ON d.id = a.disciplina_id WHERE d.nome = q.disciplina AND a.nome = q.assunto);

-- keep the text columns in sync with the linked records
CREATE OR REPLACE FUNCTION public.sync_question_names() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.disciplina_id IS NOT NULL THEN SELECT nome INTO NEW.disciplina FROM disciplinas WHERE id = NEW.disciplina_id; END IF;
  IF NEW.assunto_id IS NOT NULL THEN SELECT nome INTO NEW.assunto FROM assuntos WHERE id = NEW.assunto_id; END IF;
  IF NEW.banca_id IS NOT NULL THEN SELECT nome INTO NEW.banca FROM bancas WHERE id = NEW.banca_id; END IF;
  IF NEW.orgao_id IS NOT NULL THEN SELECT nome INTO NEW.orgao FROM orgaos WHERE id = NEW.orgao_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_question_names BEFORE INSERT OR UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.sync_question_names();

-- renaming a record updates linked questions
CREATE OR REPLACE FUNCTION public.propagate_cadastro_rename() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    EXECUTE format('UPDATE public.questions SET %I = $1 WHERE %I = $2', TG_ARGV[0], TG_ARGV[0] || '_id') USING NEW.nome, NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rename_disciplina AFTER UPDATE ON public.disciplinas FOR EACH ROW EXECUTE FUNCTION public.propagate_cadastro_rename('disciplina');
CREATE TRIGGER rename_assunto AFTER UPDATE ON public.assuntos FOR EACH ROW EXECUTE FUNCTION public.propagate_cadastro_rename('assunto');
CREATE TRIGGER rename_banca AFTER UPDATE ON public.bancas FOR EACH ROW EXECUTE FUNCTION public.propagate_cadastro_rename('banca');
CREATE TRIGGER rename_orgao AFTER UPDATE ON public.orgaos FOR EACH ROW EXECUTE FUNCTION public.propagate_cadastro_rename('orgao');