export const FACE_EXPRESSIONS = [
  "happy",
  "surprised",
  "neutral",
  "sad",
  "fearful",
  "angry",
  "disgusted",
] as const;

export type FaceExpression = (typeof FACE_EXPRESSIONS)[number];

export const EXPRESSION_RANK: Record<FaceExpression, number> = {
  happy: 3,
  surprised: 2,
  neutral: 1,
  sad: 0,
  fearful: -1,
  angry: -2,
  disgusted: -3,
};

export const NEUTRAL_RANK = EXPRESSION_RANK.neutral;

export type ExpressionSample = {
  expression: string;
  confidence: number;
  timestamp: number;
};

export type ExpressionReport = {
  totalSamples: number;
  neutralOrBelowCount: number;
};

export function isFaceExpression(value: string): value is FaceExpression {
  return FACE_EXPRESSIONS.includes(value as FaceExpression);
}

export function isNeutralOrBelow(expression: string): boolean {
  if (!isFaceExpression(expression)) {
    return false;
  }

  return EXPRESSION_RANK[expression] <= NEUTRAL_RANK;
}

export function countNeutralOrBelow(samples: readonly ExpressionSample[]): number {
  return samples.reduce((count, sample) => {
    return isNeutralOrBelow(sample.expression) ? count + 1 : count;
  }, 0);
}

export function buildExpressionReport(
  samples: readonly ExpressionSample[]
): ExpressionReport {
  return {
    totalSamples: samples.length,
    neutralOrBelowCount: countNeutralOrBelow(samples),
  };
}
