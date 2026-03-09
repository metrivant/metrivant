export type PatternType =
  | "velocity_increase"
  | "pricing_instability"
  | "positioning_shift_trend"
  | "feature_acceleration";

export type PatternStatus = "active" | "resolved" | "superseded";

export interface PatternCandidate {
  competitorId: string;
  patternType: PatternType;
  confidence: number;
  timeWindowStart: string;
  timeWindowEnd: string;
  signalCount: number;
  patternData: Record<string, unknown>;
}