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
  const link = "opacity-80 hover:opacity-100 [&.active]:font-semibold [&.active]:opacity-100";
  return (
    <header className="border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="rounded-lg bg-card px-2.5 py-1.5 shadow-sm">
          <img src={logoUrl} alt="Data5 Concursos" className="h-7 w-auto sm:h-8" />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/" className={link} activeOptions={{ exact: true }}>Questões</Link>
          <Link to="/ranking" className={link}>Ranking</Link>
          {user ? (
            <>
              <Link to="/nova-questao" className={link}>Nova questão</Link>
              <Link to="/gerar-questoes" className={link}>Gerar com IA</Link>
              {isAdmin && <Link to="/admin" className={link}>Admin</Link>}
              <button onClick={sair} className="rounded-md bg-accent px-3 py-1.5 font-semibold text-accent-foreground">Sair</button>
            </>
          ) : (
            <Link to="/auth" className="rounded-md bg-accent px-3 py-1.5 font-semibold text-accent-foreground">Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
