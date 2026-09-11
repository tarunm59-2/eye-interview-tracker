import Link from "next/link";
import { useRouter } from "next/router";
import { clearToken } from "@/lib/auth-client";
import type { PublicUser } from "@/lib/types";

export function NavBar({ user }: { user: PublicUser }) {
  const router = useRouter();

  const logout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <header className="mb-6 flex items-center justify-between">
      <Link href={user.role === "admin" ? "/admin" : "/candidate"} className="font-semibold">
        Eye Interview Tracker
      </Link>
      <div className="flex items-center gap-4 text-sm text-slate-300">
        <span>
          {user.name} · {user.role}
        </span>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg bg-slate-700 px-3 py-1.5 hover:bg-slate-600"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
