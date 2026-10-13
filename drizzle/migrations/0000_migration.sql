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