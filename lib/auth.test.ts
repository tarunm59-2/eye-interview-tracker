import { mkdirSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasRole, hashPassword, signToken, verifyPassword, verifyToken } from "./auth";
import { calculateProfessionalismScore, dominantExpression } from "./scoring";
import type { ExpressionSample } from "./types";

describe("jwt auth", () => {
  it("signs a stateless token and verifies role claims", () => {
    const token = signToken({
      id: "user-1",
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
    });
    const payload = verifyToken(token);
    expect(payload).toEqual({
      sub: "user-1",
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
    });
    expect(hasRole(payload!, ["admin"])).toBe(true);
    expect(hasRole(payload!, ["candidate"])).toBe(false);
  });

  it("rejects tampered and empty tokens", () => {
    expect(verifyToken("not-a-jwt")).toBeNull();
    expect(verifyToken("")).toBeNull();
    const token = signToken({
      id: "c1",
      email: "c@example.com",
      name: "C",
      role: "candidate",
    });
    expect(verifyToken(`${token}x`)).toBeNull();
  });

  it("hashes passwords without storing the raw value", () => {
    const hash = hashPassword("candidate123");
    expect(hash).not.toContain("candidate123");
    expect(verifyPassword("candidate123", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("scoring", () => {
  it("returns zeros until enough samples exist", () => {
    expect(calculateProfessionalismScore([])).toEqual({
      score: 0,
      stability: 0,
      engagement: 0,
      composure: 0,
      authenticity: 0,
    });
  });

  it("scores a calm seated posture highly", () => {
    const history: ExpressionSample[] = Array.from({ length: 12 }, (_, i) => ({
      expression: i % 3 === 0 ? "happy" : "neutral",
      confidence: 0.9,
      timestamp: i,
    }));
    const metrics = calculateProfessionalismScore(history);
    expect(metrics.score).toBeGreaterThan(70);
    expect(metrics.composure).toBe(100);
    expect(dominantExpression(history)).toBe("neutral");
  });
});

describe("store rbac data", () => {
  let dir: string;

  beforeEach(() => {
    dir = path.join(os.tmpdir(), `eit-test-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    process.env.DATA_FILE = path.join(dir, "db.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.DATA_FILE;
  });

  it("seeds an admin and keeps candidate assessments isolated", async () => {
    const { createAssessment, createUser, findUserByEmail, listAssessments, listCandidates } =
      await import("./store");

    const admin = await findUserByEmail("admin@example.com");
    expect(admin?.role).toBe("admin");

    const candidate = await createUser({
      email: "jane@example.com",
      name: "Jane",
      password: "password1",
      role: "candidate",
    });
    await createAssessment({
      candidateId: candidate.id,
      durationMs: 10000,
      metrics: { score: 82, stability: 80, engagement: 80, composure: 90, authenticity: 78 },
      dominantExpression: "neutral",
      snapshot: null,
      samples: [],
    });

    const all = await listAssessments();
    const own = await listAssessments({ candidateId: candidate.id });
    const other = await listAssessments({ candidateId: "missing" });
    expect(all).toHaveLength(1);
    expect(own).toHaveLength(1);
    expect(other).toHaveLength(0);
    const summaries = await listCandidates();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].user.email).toBe("jane@example.com");
    expect(summaries[0].assessmentCount).toBe(1);
  });
});
