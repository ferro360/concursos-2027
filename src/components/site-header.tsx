import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useIsAdmin } from "@/hooks/use-is-admin";
import logoUrl from "@/assets/logo.png";

export function SiteHeader() {
  const { user } = useSession();
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sair = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const link =
    "rounded-full px-3.5 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-secondary [&.active]:text-secondary-foreground";
  const cta = "rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground shadow-soft transition hover:shadow-lift hover:brightness-110";
  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-md">
      <div className="google-stripe h-1 w-full" />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="shrink-0">
          <img src={logoUrl} alt="Data5 Concursos" className="h-11 w-auto sm:h-12" />
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link to="/" className={link} activeOptions={{ exact: true }}>Questões</Link>
          <Link to="/ranking" className={link}>Ranking</Link>
          {user ? (
            <>
              <Link to="/nova-questao" className={link}>Nova questão</Link>
              <Link to="/gerar-questoes" className={link}>Gerar com IA</Link>
              {isAdmin && <Link to="/admin" className={link}>Admin</Link>}
              <button onClick={sair} className="ml-2 rounded-full border px-4 py-2 font-semibold text-foreground transition hover:bg-muted">Sair</button>
            </>
          ) : (
            <Link to="/auth" className={`ml-2 ${cta}`}>Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
