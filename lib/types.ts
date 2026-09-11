export type Role = "admin" | "candidate";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

export interface ExpressionSample {
  expression: string;
  confidence: number;
  timestamp: number;
}

export interface ProfessionalismMetrics {
  score: number;
  stability: number;
  engagement: number;
  composure: number;
  authenticity: number;
}

export interface Assessment {
  id: string;
  candidateId: string;
  createdAt: string;
  durationMs: number;
  metrics: ProfessionalismMetrics;
  dominantExpression: string;
  snapshot: string | null;
  samples: ExpressionSample[];
}

export interface CandidateSummary {
  user: PublicUser;
  assessmentCount: number;
  lastAssessmentAt: string | null;
  todayCount: number;
  averageScore: number | null;
}
