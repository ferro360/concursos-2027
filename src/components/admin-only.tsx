import type { ReactNode } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";

// A proteção real está no banco (RLS) e nas funções do servidor; isto só evita mostrar telas inúteis.
export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) return <p>Carregando...</p>;
  if (!isAdmin) return <p className="rounded-md bg-muted p-4">Acesso restrito a administradores.</p>;
  return <>{children}</>;
}
