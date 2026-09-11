import type { NextApiRequest, NextApiResponse } from "next";
import { signToken, toPublicUser, verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken(user);
  return res.status(200).json({ token, user: toPublicUser(user) });
}
