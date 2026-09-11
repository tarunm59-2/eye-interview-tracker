import { useEffect, useState } from "react";
import { apiFetch, clearToken, getToken } from "@/lib/auth-client";
import type { PublicUser } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    apiFetch<{ user: PublicUser }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, setUser };
}
