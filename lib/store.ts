import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Assessment, CandidateSummary, Role, User } from "./types";
import { hashPassword, toPublicUser } from "./auth";

type Database = {
  users: User[];
  assessments: Assessment[];
};

function dataFile() {
  return process.env.DATA_FILE || path.join(process.cwd(), "data", "db.json");
}

let writeQueue: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readDb(): Promise<Database> {
  try {
    const raw = await readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as Database;
    return {
      users: parsed.users ?? [],
      assessments: parsed.assessments ?? [],
    };
  } catch {
    return { users: [], assessments: [] };
  }
}

async function writeDb(db: Database): Promise<void> {
  const file = dataFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(db, null, 2), "utf8");
}

function seedAdmin(db: Database): void {
  if (db.users.some((u) => u.role === "admin")) {
    return;
  }
  db.users.push({
    id: randomUUID(),
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD || "admin123"),
    createdAt: new Date().toISOString(),
  });
}

export async function ensureSeeded(): Promise<void> {
  await withLock(async () => {
    const db = await readDb();
    seedAdmin(db);
    await writeDb(db);
  });
}

export async function findUserByEmail(email: string): Promise<User | null> {
  await ensureSeeded();
  const db = await readDb();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  await ensureSeeded();
  const db = await readDb();
  return db.users.find((u) => u.id === id) ?? null;
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
}): Promise<User> {
  return withLock(async () => {
    const db = await readDb();
    seedAdmin(db);
    if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("Email already registered");
    }
    const user: User = {
      id: randomUUID(),
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role,
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    await writeDb(db);
    return user;
  });
}

export async function listCandidates(): Promise<CandidateSummary[]> {
  await ensureSeeded();
  const db = await readDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.users
    .filter((u) => u.role === "candidate")
    .map((user) => {
      const assessments = db.assessments.filter((a) => a.candidateId === user.id);
      const todayAssessments = assessments.filter((a) => a.createdAt.startsWith(today));
      const averageScore =
        assessments.length === 0
          ? null
          : Math.round(
              assessments.reduce((sum, a) => sum + a.metrics.score, 0) / assessments.length,
            );
      return {
        user: toPublicUser(user),
        assessmentCount: assessments.length,
        lastAssessmentAt: assessments.at(-1)?.createdAt ?? null,
        todayCount: todayAssessments.length,
        averageScore,
      };
    })
    .sort((a, b) => a.user.name.localeCompare(b.user.name));
}

export async function createAssessment(
  input: Omit<Assessment, "id" | "createdAt">,
): Promise<Assessment> {
  return withLock(async () => {
    const db = await readDb();
    const assessment: Assessment = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    db.assessments.push(assessment);
    await writeDb(db);
    return assessment;
  });
}

export async function listAssessments(filter?: {
  candidateId?: string;
}): Promise<Assessment[]> {
  await ensureSeeded();
  const db = await readDb();
  const items = filter?.candidateId
    ? db.assessments.filter((a) => a.candidateId === filter.candidateId)
    : db.assessments;
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
