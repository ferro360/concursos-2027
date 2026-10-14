import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { SiteHeader } from "@/components/site-header";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Banco de Questões" },
      { name: "description", content: "Entre ou crie sua conta para resolver questões e entrar no ranking." },
      { property: "og:title", content: "Entrar — Banco de Questões" },
      { property: "og:description", content: "Crie sua conta e comece a resolver questões." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const TITULO = { entrar: "Entrar", cadastrar: "Criar conta", esqueci: "Recuperar senha", "nova-senha": "Criar nova senha" };
const BOTAO = { entrar: "Entrar", cadastrar: "Cadastrar", esqueci: "Enviar link", "nova-senha": "Salvar senha" };

function AuthPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  // "nova-senha": voltou do link de recuperação enviado por e-mail (também serve para quem entrava com Google criar uma senha)
  const [modo, setModo] = useState<"entrar" | "cadastrar" | "esqueci" | "nova-senha">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("redefinir") ? "nova-senha" : "entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user && modo !== "nova-senha") navigate({ to: "/" }); }, [user, modo, navigate]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => { if (evento === "PASSWORD_RECOVERY") setModo("nova-senha"); });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (modo === "esqueci") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth?redefinir=1` });
      if (error) toast.error("Não foi possível enviar o e-mail. Tente novamente.");
      else { toast.success("Enviamos um link para criar uma nova senha. Confira seu e-mail."); setModo("entrar"); }
    } else if (modo === "nova-senha") {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) toast.error("Link expirado ou inválido. Peça um novo.");
      else { toast.success("Senha definida!"); navigate({ to: "/" }); }
    } else if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) toast.error("E-mail ou senha inválidos.");
    } else {
      const { error } = await supabase.auth.signUp({
        email, password: senha,
        options: { emailRedirectTo: window.location.origin, data: { username } },
      });
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
    }
    setLoading(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com Google.");
  };

  const input = "w-full rounded-md border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-sm px-4 py-12">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="mb-6 font-display text-2xl font-bold">{TITULO[modo]}</h1>
          {modo === "esqueci" && <p className="mb-4 text-sm text-muted-foreground">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>}
          {(modo === "entrar" || modo === "cadastrar") && (
            <>
              <button onClick={google} className="mb-4 w-full rounded-md border py-2 font-semibold hover:bg-muted">Continuar com Google</button>
              <div className="mb-4 text-center text-xs text-muted-foreground">ou</div>
            </>
          )}
          <form onSubmit={submit} className="space-y-3">
            {modo === "cadastrar" && (
              <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nome de usuário" className={input} />
            )}
            {modo !== "nova-senha" && (
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={input} />
            )}
            {modo !== "esqueci" && (
              <input required type="password" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={modo === "nova-senha" ? "Nova senha" : "Senha"} className={input} />
            )}
            <button disabled={loading} className="w-full rounded-md bg-primary py-2 font-semibold text-primary-foreground disabled:opacity-50">
              {BOTAO[modo]}
            </button>
          </form>
          {modo === "entrar" && (
            <button onClick={() => setModo("esqueci")} className="mt-4 w-full text-sm text-muted-foreground underline">Esqueci minha senha</button>
          )}
          {modo !== "nova-senha" && (
            <button onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")} className="mt-2 w-full text-sm text-primary underline">
              {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
