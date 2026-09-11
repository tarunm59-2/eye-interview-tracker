import type { NextApiRequest, NextApiResponse } from "next";
import type { Role, TokenPayload } from "./types";
import { hasRole, verifyToken } from "./auth";

export function readBearerToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
}

export function getAuthUser(req: NextApiRequest): TokenPayload | null {
  const token = readBearerToken(req);
  if (!token) return null;
  return verifyToken(token);
}

export function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  roles?: Role[],
): TokenPayload | null {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (roles && !hasRole(user, roles)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return user;
}
