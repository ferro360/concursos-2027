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
