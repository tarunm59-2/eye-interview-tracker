import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/api-auth";
import { calculateProfessionalismScore, dominantExpression } from "@/lib/scoring";
import { createAssessment, listAssessments } from "@/lib/store";
import type { ExpressionSample, ProfessionalismMetrics } from "@/lib/types";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

function isMetrics(value: unknown): value is ProfessionalismMetrics {
  if (!value || typeof value !== "object") return false;
  const metrics = value as ProfessionalismMetrics;
  return [metrics.score, metrics.stability, metrics.engagement, metrics.composure, metrics.authenticity].every(
    (n) => typeof n === "number" && Number.isFinite(n),
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const requestedId =
      typeof req.query.candidateId === "string" ? req.query.candidateId : undefined;

    if (auth.role === "candidate") {
      const assessments = await listAssessments({ candidateId: auth.sub });
      return res.status(200).json({ assessments });
    }

    const assessments = await listAssessments(
      requestedId ? { candidateId: requestedId } : undefined,
    );
    return res.status(200).json({ assessments });
  }

  if (req.method === "POST") {
    const auth = requireAuth(req, res, ["candidate"]);
    if (!auth) return;

    const durationMs = Number(req.body?.durationMs);
    const samples = Array.isArray(req.body?.samples) ? (req.body.samples as ExpressionSample[]) : [];
    const snapshot =
      typeof req.body?.snapshot === "string" && req.body.snapshot.startsWith("data:image/")
        ? req.body.snapshot
        : null;

    if (!Number.isFinite(durationMs) || durationMs < 8000 || durationMs > 15000) {
      return res.status(400).json({ error: "Integrity assessment must last about 10 seconds" });
    }

    const validSamples = samples.filter(
      (s) =>
        s &&
        typeof s.expression === "string" &&
        typeof s.confidence === "number" &&
        typeof s.timestamp === "number",
    );

    const metrics = isMetrics(req.body?.metrics)
      ? req.body.metrics
      : calculateProfessionalismScore(validSamples);

    const assessment = await createAssessment({
      candidateId: auth.sub,
      durationMs: Math.round(durationMs),
      metrics,
      dominantExpression:
        typeof req.body?.dominantExpression === "string"
          ? req.body.dominantExpression
          : dominantExpression(validSamples),
      snapshot,
      samples: validSamples.slice(-40),
    });

    return res.status(201).json({ assessment });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
