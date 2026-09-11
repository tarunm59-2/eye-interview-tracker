import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Role, TokenPayload, User } from "./types";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = "12h";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return bcrypt.compareSync(password, passwordHash);
}

export function signToken(user: Pick<User, "id" | "email" | "name" | "role">): string {
  return jwt.sign(
    { email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { subject: user.id, expiresIn: JWT_EXPIRES_IN },
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const role = decoded.role as Role | undefined;
    if (!decoded.sub || !decoded.email || (role !== "admin" && role !== "candidate")) {
      return null;
    }
    return {
      sub: decoded.sub,
      email: String(decoded.email),
      name: String(decoded.name ?? ""),
      role,
    };
  } catch {
    return null;
  }
}

export function hasRole(user: TokenPayload, roles: Role[]): boolean {
  return roles.includes(user.role);
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}
