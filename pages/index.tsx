import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiFetch, clearToken, getToken } from "@/lib/auth-client";
import type { PublicUser } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ user: PublicUser }>("/api/auth/me")
      .then(({ user }) => {
        router.replace(user.role === "admin" ? "/admin" : "/candidate");
      })
      .catch(() => {
        clearToken();
        setMessage("Session expired");
        router.replace("/login");
      });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">
      {message}
    </main>
  );
}
