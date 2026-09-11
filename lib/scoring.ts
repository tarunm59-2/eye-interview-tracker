import type { ExpressionSample, ProfessionalismMetrics } from "./types";

const POSITIVE = new Set(["happy", "surprised"]);
const NEGATIVE = new Set(["angry", "fearful", "disgusted", "sad"]);
const STABLE = new Set(["neutral", "happy"]);

export function calculateProfessionalismScore(
  history: ExpressionSample[],
): ProfessionalismMetrics {
  if (history.length < 5) {
    return { score: 0, stability: 0, engagement: 0, composure: 0, authenticity: 0 };
  }

  const expressionCounts = history.reduce(
    (acc, curr) => {
      acc[curr.expression] = (acc[curr.expression] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const dominantExpressions = Object.entries(expressionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const stabilityBonus = dominantExpressions.reduce((sum, [expr, count]) => {
    const percentage = count / history.length;
    if (STABLE.has(expr)) return sum + percentage * 100;
    if (NEGATIVE.has(expr) || expr === "surprised") {
      return sum + Math.max(0, percentage * 50 - 20);
    }
    return sum;
  }, 0);

  const stability = Math.min(100, stabilityBonus);

  const positiveExpressions = history.filter(
    (h) => POSITIVE.has(h.expression) && h.confidence > 0.6,
  );
  const neutralExpressions = history.filter((h) => h.expression === "neutral");
  const engagementRatio =
    (positiveExpressions.length + neutralExpressions.length * 0.7) / history.length;
  const engagement = Math.min(100, engagementRatio * 120);

  const negativeExpressions = history.filter((h) => NEGATIVE.has(h.expression));
  const composure = Math.max(0, 100 - (negativeExpressions.length / history.length) * 200);

  const avgConfidence =
    history.reduce((sum, h) => sum + h.confidence, 0) / history.length;
  const expressionVariety = Object.keys(expressionCounts).length;
  const confidenceScore = Math.min(100, avgConfidence * 120);
  const varietyScore =
    expressionVariety >= 2 && expressionVariety <= 4
      ? 100
      : expressionVariety === 1
        ? 60
        : Math.max(20, 100 - (expressionVariety - 4) * 15);
  const authenticity = (confidenceScore + varietyScore) / 2;

  const overallScore =
    stability * 0.25 + engagement * 0.25 + composure * 0.25 + authenticity * 0.25;

  return {
    score: Math.round(overallScore),
    stability: Math.round(stability),
    engagement: Math.round(engagement),
    composure: Math.round(composure),
    authenticity: Math.round(authenticity),
  };
}

export function dominantExpression(history: ExpressionSample[]): string {
  if (history.length === 0) return "unknown";
  const counts = history.reduce(
    (acc, curr) => {
      acc[curr.expression] = (acc[curr.expression] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 50) return "Below Average";
  return "Needs Improvement";
}
