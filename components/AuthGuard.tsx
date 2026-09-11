import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/lib/types";

export function AuthGuard({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== role) {
      router.replace(user.role === "admin" ? "/admin" : "/candidate");
    }
  }, [loading, role, router, user]);

  if (loading || !user || user.role !== role) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">
        Loading...
      </main>
    );
  }

  return <>{children}</>;
}
