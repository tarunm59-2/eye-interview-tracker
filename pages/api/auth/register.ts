import type { NextApiRequest, NextApiResponse } from "next";
import { signToken, toPublicUser } from "@/lib/auth";
import { createUser } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !name || password.length < 8) {
    return res.status(400).json({
      error: "Name, email, and a password of at least 8 characters are required",
    });
  }

  try {
    const user = await createUser({
      email,
      name,
      password,
      role: "candidate",
    });
    const token = signToken(user);
    return res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to register";
    const status = message === "Email already registered" ? 409 : 400;
    return res.status(status).json({ error: message });
  }
}
