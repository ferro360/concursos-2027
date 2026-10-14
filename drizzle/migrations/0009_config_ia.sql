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
