-- Banco completo do Data5 Concursos para um projeto Supabase novo e vazio.
-- Gerado a partir de drizzle/migrations, na ordem. Cole no SQL Editor do Supabase e execute uma vez.
-- Depois de criar sua conta no app, torne-se admin com:
--   insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'SEU_EMAIL';


-- ===== 0000_migration.sql =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'username',''), NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.questions (
  id bigserial PRIMARY KEY,
  disciplina text NOT NULL,
  assunto text NOT NULL,
  banca text NOT NULL,
  orgao text NOT NULL,
  ano int NOT NULL,
  enunciado text NOT NULL,
  alternativas text[] NOT NULL,
  correta int NOT NULL,
  comentario text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (correta >= 0 AND correta < array_length(alternativas,1)),
  CHECK (array_length(alternativas,1) BETWEEN 2 AND 5)
);
GRANT SELECT ON public.questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
GRANT USAGE ON SEQUENCE public.questions_id_seq TO authenticated;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions public read" ON public.questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "questions own insert" ON public.questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "questions own update" ON public.questions FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "questions own delete" ON public.questions FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TABLE public.answers (
  user_id uuid NOT NULL,
  question_id bigint NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  alternativa int NOT NULL,
  acertou boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
GRANT SELECT, INSERT, DELETE ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answers own read" ON public.answers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "answers own insert" ON public.answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "answers own delete" ON public.answers FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.grade_answer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT (q.correta = NEW.alternativa) INTO NEW.acertou FROM public.questions q WHERE q.id = NEW.question_id;
  NEW.acertou := COALESCE(NEW.acertou, false);
  RETURN NEW;
END $$;
CREATE TRIGGER grade_answer BEFORE INSERT ON public.answers FOR EACH ROW EXECUTE FUNCTION public.grade_answer();

CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(user_id uuid, username text, resolvidas bigint, acertos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, count(a.*), count(a.*) FILTER (WHERE a.acertou)
  FROM public.profiles p JOIN public.answers a ON a.user_id = p.id
  GROUP BY p.id, p.username
  ORDER BY 4 DESC, 3 ASC
  LIMIT 100
$$;
GRANT EXECUTE ON FUNCTION public.get_ranking() TO anon, authenticated;

INSERT INTO public.questions (disciplina, assunto, banca, orgao, ano, enunciado, alternativas, correta, comentario) VALUES
('Português','Crase','CESPE/CEBRASPE','TRF 1ª Região',2024,'Assinale a alternativa em que o emprego do acento indicativo de crase está correto.',ARRAY['Fui à pé até o trabalho.','Entreguei o relatório à diretora.','Começou à chover forte.','Refiro-me à pessoas específicas.','Ficamos frente à frente.'],1,'Há crase em "à diretora": o verbo entregar exige a preposição "a" e "diretora" admite o artigo feminino "a".'),
('Direito Constitucional','Direitos Fundamentais','FGV','TJ-SP',2023,'Segundo a Constituição Federal de 1988, a casa é asilo inviolável do indivíduo. É permitido nela penetrar sem consentimento do morador:',ARRAY['Apenas durante o dia, em qualquer hipótese.','Em caso de flagrante delito, a qualquer hora.','Somente com ordem do delegado.','Nunca, sem exceções.','Apenas à noite, com ordem judicial.'],1,'Art. 5º, XI: flagrante delito, desastre ou prestar socorro a qualquer hora; por determinação judicial, apenas durante o dia.'),
('Raciocínio Lógico','Proposições','VUNESP','PM-SP',2024,'A negação da proposição "Todo policial é atento" é:',ARRAY['Nenhum policial é atento.','Algum policial não é atento.','Todo policial é desatento.','Algum policial é atento.','Nenhum atento é policial.'],1,'A negação de "Todo A é B" é "Algum A não é B".'),
('Direito Administrativo','Atos Administrativos','CESPE/CEBRASPE','INSS',2022,'O atributo do ato administrativo que permite à Administração executá-lo diretamente, sem necessidade de recorrer ao Judiciário, denomina-se:',ARRAY['Presunção de legitimidade','Tipicidade','Autoexecutoriedade','Imperatividade','Motivação'],2,'Autoexecutoriedade é a possibilidade de a Administração executar seus atos por meios próprios.'),
('Informática','Segurança da Informação','FCC','Banco do Brasil',2023,'O tipo de malware que sequestra dados criptografando-os e exige pagamento para liberá-los é o:',ARRAY['Spyware','Worm','Ransomware','Adware','Keylogger'],2,'Ransomware criptografa os dados da vítima e exige resgate.'),
('Português','Concordância Verbal','FGV','Senado Federal',2022,'Assinale a frase com concordância verbal correta.',ARRAY['Fazem dois anos que não o vejo.','Haviam muitos candidatos na sala.','Existem muitas dúvidas sobre o edital.','Precisa-se de vendedores e aluga-se casas.','Houveram problemas na prova.'],2,'"Existir" é pessoal e concorda com o sujeito "muitas dúvidas". "Fazer" (tempo) e "haver" (existir) são impessoais.'),
('Direito Constitucional','Organização do Estado','VUNESP','Câmara de SP',2024,'Compete privativamente à União legislar sobre:',ARRAY['Direito tributário','Direito penal','Educação e cultura','Proteção ao meio ambiente','Orçamento'],1,'Art. 22, I: direito penal é competência privativa da União. Os demais são concorrentes (art. 24).'),
('Raciocínio Lógico','Sequências','FCC','TRT 2ª Região',2023,'Qual o próximo termo da sequência: 2, 6, 12, 20, 30, ...?',ARRAY['40','42','44','36','38'],1,'As diferenças são 4, 6, 8, 10, 12. Logo, 30 + 12 = 42.');

-- ===== 0001_admin_roles.sql =====
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles own read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

CREATE POLICY "questions admin update" ON public.questions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "questions admin delete" ON public.questions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles admin update" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "answers admin delete" ON public.answers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, username text, email text, created_at timestamptz, is_admin boolean, resolvidas bigint, acertos bigint, questoes bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, u.email::text, p.created_at,
    public.has_role(p.id, 'admin'),
    (SELECT count(*) FROM public.answers a WHERE a.user_id = p.id),
    (SELECT count(*) FROM public.answers a WHERE a.user_id = p.id AND a.acertou),
    (SELECT count(*) FROM public.questions q WHERE q.created_by = p.id)
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM public.profiles ORDER BY created_at LIMIT 1;

-- ===== 0002_cadastros.sql =====
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

-- ===== 0003_question_assuntos.sql =====
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

-- ===== 0004_question_media.sql =====
ALTER TABLE public.questions ADD COLUMN imagem_url text NOT NULL DEFAULT '';
ALTER TABLE public.questions ADD COLUMN video_url text NOT NULL DEFAULT '';

-- ===== 0005_criar_tipo_questao_certo_errado.sql =====
ALTER TABLE public.questions
  ADD COLUMN tipo text NOT NULL DEFAULT 'multipla_escolha'
  CHECK (tipo IN ('multipla_escolha', 'certo_errado'));

COMMENT ON COLUMN public.questions.tipo IS 'multipla_escolha (alternativas A-E) ou certo_errado (alternativas fixas: Certo, Errado)';

-- ===== 0006_niveis_escolaridade.sql =====
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

-- ===== 0007_biblioteca_conhecimento.sql =====
create extension if not exists vector;

create table public.knowledge_docs (
  id bigserial primary key,
  user_id uuid not null,
  titulo text not null,
  disciplina_id bigint references public.disciplinas(id) on delete set null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create table public.knowledge_chunks (
  id bigserial primary key,
  doc_id bigint not null references public.knowledge_docs(id) on delete cascade,
  ordem int not null default 0,
  conteudo text not null,
  embedding vector(3072) not null
);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

GRANT SELECT ON public.knowledge_docs TO authenticated;
GRANT SELECT, INSERT ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_docs TO service_role;
GRANT ALL ON public.knowledge_chunks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.knowledge_docs_id_seq, public.knowledge_chunks_id_seq TO authenticated;

alter table public.knowledge_docs enable row level security;
alter table public.knowledge_chunks enable row level security;

create policy "docs leitura para logados"
  on public.knowledge_docs for select to authenticated using (true);
create policy "docs inserir admin"
  on public.knowledge_docs for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "docs excluir admin"
  on public.knowledge_docs for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "chunks leitura para logados"
  on public.knowledge_chunks for select to authenticated using (true);
create policy "chunks inserir admin"
  on public.knowledge_chunks for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.match_knowledge(
  query_embedding vector(3072),
  match_count int default 12,
  filtro_disciplina bigint default null
)
returns table (
  id bigint,
  doc_id bigint,
  titulo text,
  ordem int,
  conteudo text,
  similarity float
)
language sql stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.doc_id,
    d.titulo,
    c.ordem,
    c.conteudo,
    1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.knowledge_chunks c
  join public.knowledge_docs d on d.id = c.doc_id
  where filtro_disciplina is null or d.disciplina_id = filtro_disciplina
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

grant execute on function public.match_knowledge(vector(3072), int, bigint) to authenticated;


-- ===== 0008_seguranca_desempenho.sql =====
-- Segurança do gabarito/ranking e desempenho para um banco grande (500 mil+ questões).

---------------------------------------------------------------------------
-- 1. Questões, vínculos de assunto e cadastros: escrita só para administradores
---------------------------------------------------------------------------
DROP POLICY IF EXISTS "questions own insert" ON public.questions;
DROP POLICY IF EXISTS "questions own update" ON public.questions;
DROP POLICY IF EXISTS "questions own delete" ON public.questions;
CREATE POLICY "questions admin insert" ON public.questions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

DROP POLICY IF EXISTS "qa owner insert" ON public.question_assuntos;
DROP POLICY IF EXISTS "qa owner delete" ON public.question_assuntos;
CREATE POLICY "qa admin insert" ON public.question_assuntos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "qa admin delete" ON public.question_assuntos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['disciplinas','assuntos','bancas','orgaos','niveis'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth insert" ON public.%I', t);
    EXECUTE format('CREATE POLICY "admin insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;

---------------------------------------------------------------------------
-- 2. Gabarito e comentário deixam de ser legíveis pela API.
--    Só são devolvidos (por buscar_questoes / responder_questao) depois que o
--    próprio usuário respondeu; admins leem a questão completa por admin_get_question.
---------------------------------------------------------------------------
REVOKE SELECT ON public.questions FROM anon, authenticated;
GRANT SELECT (id, disciplina, assunto, banca, orgao, ano, enunciado, alternativas, created_by, created_at,
  disciplina_id, assunto_id, banca_id, orgao_id, nivel_id, nivel, imagem_url, video_url, tipo)
  ON public.questions TO anon, authenticated;

-- 3. Respostas são definitivas: o aluno não apaga mais (só admin), então não dá
--    para errar, ver o gabarito e responder de novo.
DROP POLICY IF EXISTS "answers own delete" ON public.answers;
-- DELETE só alcança linhas visíveis por SELECT: sem isto o "zerar respostas" do admin não apagava nada.
CREATE POLICY "answers admin read" ON public.answers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

---------------------------------------------------------------------------
-- 4. Estatísticas por usuário mantidas por gatilho (ranking sem varrer answers)
---------------------------------------------------------------------------
CREATE TABLE public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  resolvidas bigint NOT NULL DEFAULT 0,
  acertos bigint NOT NULL DEFAULT 0
);
GRANT SELECT ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats own read" ON public.user_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX user_stats_ranking_idx ON public.user_stats (acertos DESC, resolvidas ASC);

INSERT INTO public.user_stats (user_id, resolvidas, acertos)
SELECT a.user_id, count(*), count(*) FILTER (WHERE a.acertou)
FROM public.answers a JOIN public.profiles p ON p.id = a.user_id
GROUP BY a.user_id;

CREATE OR REPLACE FUNCTION public.stats_resposta_inserida() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_stats AS s (user_id, resolvidas, acertos)
  VALUES (NEW.user_id, 1, NEW.acertou::int)
  ON CONFLICT (user_id) DO UPDATE SET resolvidas = s.resolvidas + 1, acertos = s.acertos + EXCLUDED.acertos;
  RETURN NULL;
END $$;
CREATE TRIGGER stats_resposta_inserida AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.stats_resposta_inserida();

-- por comando (não por linha): "zerar respostas" do admin e exclusão de questão apagam muitas linhas de uma vez
CREATE OR REPLACE FUNCTION public.stats_respostas_removidas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_stats s SET resolvidas = s.resolvidas - r.n, acertos = s.acertos - r.a
  FROM (SELECT user_id, count(*) AS n, count(*) FILTER (WHERE acertou) AS a FROM removidas GROUP BY user_id) r
  WHERE s.user_id = r.user_id;
  RETURN NULL;
END $$;
CREATE TRIGGER stats_respostas_removidas AFTER DELETE ON public.answers
  REFERENCING OLD TABLE AS removidas FOR EACH STATEMENT EXECUTE FUNCTION public.stats_respostas_removidas();

CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(user_id uuid, username text, resolvidas bigint, acertos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, p.username, s.resolvidas, s.acertos
  FROM public.user_stats s JOIN public.profiles p ON p.id = s.user_id
  WHERE s.resolvidas > 0
  ORDER BY s.acertos DESC, s.resolvidas ASC
  LIMIT 100
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, username text, email text, created_at timestamptz, is_admin boolean, resolvidas bigint, acertos bigint, questoes bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, u.email::text, p.created_at,
    public.has_role(p.id, 'admin'),
    COALESCE(s.resolvidas, 0), COALESCE(s.acertos, 0),
    (SELECT count(*) FROM public.questions q WHERE q.created_by = p.id)
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_stats s ON s.user_id = p.id
  ORDER BY p.created_at DESC;
END $$;

---------------------------------------------------------------------------
-- 5. Índices e busca textual
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sem_acento(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT translate(lower($1), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
$$;

ALTER TABLE public.questions ADD COLUMN busca tsvector GENERATED ALWAYS AS (
  to_tsvector('portuguese'::regconfig, public.sem_acento(enunciado || ' ' || disciplina || ' ' || assunto || ' ' || banca || ' ' || orgao))
) STORED;

CREATE INDEX questions_busca_idx ON public.questions USING gin (busca);
CREATE INDEX questions_disciplina_idx ON public.questions (disciplina_id, id DESC);
CREATE INDEX questions_assunto_idx ON public.questions (assunto_id);
CREATE INDEX questions_banca_idx ON public.questions (banca_id, id DESC);
CREATE INDEX questions_orgao_idx ON public.questions (orgao_id, id DESC);
CREATE INDEX questions_nivel_idx ON public.questions (nivel_id, id DESC);
CREATE INDEX questions_ano_idx ON public.questions (ano, id DESC);
CREATE INDEX questions_created_by_idx ON public.questions (created_by);
CREATE INDEX question_assuntos_assunto_idx ON public.question_assuntos (assunto_id, question_id);
CREATE INDEX answers_question_idx ON public.answers (question_id);

---------------------------------------------------------------------------
-- 6. Busca paginada no servidor
---------------------------------------------------------------------------
-- Monta o WHERE com só os filtros informados (SQL dinâmico = plano ideal para cada combinação).
-- Parâmetros: $1 uid, $2 disciplina, $3 assunto, $4 banca, $5 orgao, $6 nivel, $7 ano, $8 tipo, $9 busca, $10 situacao
CREATE OR REPLACE FUNCTION public.filtro_questoes(
  p_uid uuid, p_disciplina_id bigint, p_assunto_id bigint, p_banca_id bigint, p_orgao_id bigint,
  p_nivel_id bigint, p_ano int, p_tipo text, p_busca text, p_situacao text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE w text := 'true';
BEGIN
  IF p_disciplina_id IS NOT NULL THEN w := w || ' AND q.disciplina_id = $2'; END IF;
  IF p_assunto_id IS NOT NULL THEN
    w := w || ' AND EXISTS (SELECT 1 FROM public.question_assuntos qa WHERE qa.question_id = q.id AND qa.assunto_id = $3)';
  END IF;
  IF p_banca_id IS NOT NULL THEN w := w || ' AND q.banca_id = $4'; END IF;
  IF p_orgao_id IS NOT NULL THEN w := w || ' AND q.orgao_id = $5'; END IF;
  IF p_nivel_id IS NOT NULL THEN w := w || ' AND q.nivel_id = $6'; END IF;
  IF p_ano IS NOT NULL THEN w := w || ' AND q.ano = $7'; END IF;
  IF p_tipo IS NOT NULL THEN w := w || ' AND q.tipo = $8'; END IF;
  IF p_busca ~ '^\s*[Qq]?\d+\s*$' THEN
    w := w || ' AND q.id = regexp_replace($9, ''\D'', '''', ''g'')::bigint';
  ELSIF nullif(trim(p_busca), '') IS NOT NULL THEN
    w := w || ' AND q.busca @@ websearch_to_tsquery(''portuguese'', public.sem_acento($9))';
  END IF;
  IF p_uid IS NOT NULL AND p_situacao IS NOT NULL THEN
    w := w || CASE p_situacao
      WHEN 'nao' THEN ' AND NOT EXISTS (SELECT 1 FROM public.answers a WHERE a.user_id = $1 AND a.question_id = q.id)'
      WHEN 'resolvidas' THEN ' AND EXISTS (SELECT 1 FROM public.answers a WHERE a.user_id = $1 AND a.question_id = q.id)'
      WHEN 'acertei' THEN ' AND EXISTS (SELECT 1 FROM public.answers a WHERE a.user_id = $1 AND a.question_id = q.id AND a.acertou)'
      WHEN 'errei' THEN ' AND EXISTS (SELECT 1 FROM public.answers a WHERE a.user_id = $1 AND a.question_id = q.id AND NOT a.acertou)'
      ELSE '' END;
  END IF;
  RETURN w;
END $$;
REVOKE EXECUTE ON FUNCTION public.filtro_questoes(uuid, bigint, bigint, bigint, bigint, bigint, int, text, text, text) FROM PUBLIC, anon, authenticated;

-- Página de questões (paginação por cursor: p_antes_de = menor id da página anterior).
-- Gabarito e comentário só vêm nas questões que o usuário já respondeu.
CREATE OR REPLACE FUNCTION public.buscar_questoes(
  p_disciplina_id bigint DEFAULT NULL, p_assunto_id bigint DEFAULT NULL, p_banca_id bigint DEFAULT NULL,
  p_orgao_id bigint DEFAULT NULL, p_nivel_id bigint DEFAULT NULL, p_ano int DEFAULT NULL, p_tipo text DEFAULT NULL,
  p_busca text DEFAULT NULL, p_situacao text DEFAULT NULL, p_antes_de bigint DEFAULT NULL, p_limite int DEFAULT 20
) RETURNS TABLE (
  id bigint, disciplina text, assuntos text[], banca text, orgao text, ano int, nivel text, tipo text,
  enunciado text, alternativas text[], imagem_url text, video_url text,
  respondida int, acertou boolean, correta int, comentario text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  w text := public.filtro_questoes(uid, p_disciplina_id, p_assunto_id, p_banca_id, p_orgao_id, p_nivel_id, p_ano, p_tipo, p_busca, p_situacao);
BEGIN
  IF p_antes_de IS NOT NULL THEN w := w || ' AND q.id < $11'; END IF;
  RETURN QUERY EXECUTE format($q$
    WITH pagina AS (
      SELECT q.id FROM public.questions q WHERE %s ORDER BY q.id DESC LIMIT $12
    )
    SELECT q.id, q.disciplina,
      COALESCE((SELECT array_agg(s.nome ORDER BY s.nome) FROM public.question_assuntos qa
                JOIN public.assuntos s ON s.id = qa.assunto_id WHERE qa.question_id = q.id), ARRAY[q.assunto]),
      q.banca, q.orgao, q.ano, q.nivel, q.tipo, q.enunciado, q.alternativas, q.imagem_url, q.video_url,
      r.alternativa, r.acertou,
      CASE WHEN r.user_id IS NOT NULL THEN q.correta END,
      CASE WHEN r.user_id IS NOT NULL THEN q.comentario END
    FROM pagina p
    JOIN public.questions q ON q.id = p.id
    LEFT JOIN public.answers r ON r.user_id = $1 AND r.question_id = q.id
    ORDER BY q.id DESC
  $q$, w)
  USING uid, p_disciplina_id, p_assunto_id, p_banca_id, p_orgao_id, p_nivel_id, p_ano, p_tipo, p_busca, p_situacao,
        p_antes_de, least(greatest(coalesce(p_limite, 20), 1), 50);
END $$;
REVOKE EXECUTE ON FUNCTION public.buscar_questoes(bigint, bigint, bigint, bigint, bigint, int, text, text, text, bigint, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_questoes(bigint, bigint, bigint, bigint, bigint, int, text, text, text, bigint, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.contar_questoes(
  p_disciplina_id bigint DEFAULT NULL, p_assunto_id bigint DEFAULT NULL, p_banca_id bigint DEFAULT NULL,
  p_orgao_id bigint DEFAULT NULL, p_nivel_id bigint DEFAULT NULL, p_ano int DEFAULT NULL, p_tipo text DEFAULT NULL,
  p_busca text DEFAULT NULL, p_situacao text DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  w text := public.filtro_questoes(uid, p_disciplina_id, p_assunto_id, p_banca_id, p_orgao_id, p_nivel_id, p_ano, p_tipo, p_busca, p_situacao);
  total bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.questions q WHERE %s', w) INTO total
  USING uid, p_disciplina_id, p_assunto_id, p_banca_id, p_orgao_id, p_nivel_id, p_ano, p_tipo, p_busca, p_situacao;
  RETURN total;
END $$;
REVOKE EXECUTE ON FUNCTION public.contar_questoes(bigint, bigint, bigint, bigint, bigint, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_questoes(bigint, bigint, bigint, bigint, bigint, int, text, text, text) TO anon, authenticated;

-- Anos distintos via "skip scan" no índice de ano (não lê a tabela inteira).
CREATE OR REPLACE FUNCTION public.anos_questoes() RETURNS SETOF int
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH RECURSIVE t(ano) AS (
    (SELECT q.ano FROM public.questions q ORDER BY q.ano DESC LIMIT 1)
    UNION ALL
    SELECT (SELECT q.ano FROM public.questions q WHERE q.ano < t.ano ORDER BY q.ano DESC LIMIT 1)
    FROM t WHERE t.ano IS NOT NULL
  )
  SELECT t.ano FROM t WHERE t.ano IS NOT NULL
$$;
GRANT EXECUTE ON FUNCTION public.anos_questoes() TO anon, authenticated;

-- Registra a resposta (a primeira é a que vale) e devolve gabarito e comentário.
CREATE OR REPLACE FUNCTION public.responder_questao(p_question_id bigint, p_alternativa int)
RETURNS TABLE (alternativa int, acertou boolean, correta int, comentario text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'login necessário' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.answers (user_id, question_id, alternativa) VALUES (uid, p_question_id, p_alternativa)
  ON CONFLICT (user_id, question_id) DO NOTHING;
  RETURN QUERY
  SELECT a.alternativa, a.acertou, q.correta, q.comentario
  FROM public.answers a JOIN public.questions q ON q.id = a.question_id
  WHERE a.user_id = uid AND a.question_id = p_question_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.responder_questao(bigint, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_questao(bigint, int) TO authenticated;

-- Questão completa (com gabarito) para edição no admin.
CREATE OR REPLACE FUNCTION public.admin_get_question(p_id bigint) RETURNS SETOF public.questions
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.questions WHERE id = p_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_question(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_question(bigint) TO authenticated;

---------------------------------------------------------------------------
-- 7. Cota diária de uso da IA por usuário (admins sem limite)
---------------------------------------------------------------------------
CREATE TABLE public.ai_uso (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia date NOT NULL DEFAULT current_date,
  usos int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, dia)
);
GRANT ALL ON public.ai_uso TO service_role;
ALTER TABLE public.ai_uso ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consumir_cota_ia(p_limite int) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF public.has_role(uid, 'admin') THEN RETURN true; END IF;
  INSERT INTO public.ai_uso AS u (user_id, dia, usos) VALUES (uid, current_date, 1)
  ON CONFLICT (user_id, dia) DO UPDATE SET usos = u.usos + 1 WHERE u.usos < p_limite
  RETURNING u.usos INTO n;
  RETURN n IS NOT NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.consumir_cota_ia(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consumir_cota_ia(int) TO authenticated;


-- ===== 0009_config_ia.sql =====
-- Configuração da IA editável pelo admin (sem segredos: as chaves de API ficam nas variáveis/Secrets do servidor).
CREATE TABLE public.ia_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provedor text NOT NULL DEFAULT 'lovable' CHECK (provedor IN ('lovable', 'openrouter')),
  plano_b boolean NOT NULL DEFAULT true,
  openrouter_modelo text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ia_config DEFAULT VALUES;

GRANT SELECT, UPDATE ON public.ia_config TO authenticated;
GRANT ALL ON public.ia_config TO service_role;
ALTER TABLE public.ia_config ENABLE ROW LEVEL SECURITY;
-- o servidor lê com o login de quem chama, então todo usuário logado precisa poder ler
CREATE POLICY "ia_config leitura" ON public.ia_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "ia_config admin update" ON public.ia_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

