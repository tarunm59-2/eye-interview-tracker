import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { apiFetch, getToken, setToken } from "@/lib/auth-client";
import type { PublicUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    apiFetch<{ user: PublicUser }>("/api/auth/me")
      .then(({ user }) => {
        router.replace(user.role === "admin" ? "/admin" : "/candidate");
      })
      .catch(() => undefined);
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: PublicUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      router.replace(data.user.role === "admin" ? "/admin" : "/candidate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-slate-800 p-8"
      >
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm text-slate-400">
          Stateless JWT login. Admins review all candidates; candidates submit a 10-second
          integrity assessment.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <label className="block text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2"
            required
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 py-2 font-medium hover:bg-blue-500 disabled:bg-slate-600"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-center text-sm text-slate-400">
          Candidate?{" "}
          <Link href="/register" className="text-blue-400 hover:underline">
            Create an account
          </Link>
        </p>
        <p className="text-xs text-slate-500">
          Seeded admin: admin@example.com / admin123
        </p>
      </form>
    </main>
  );
}
