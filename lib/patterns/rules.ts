import { PatternCandidate } from "./types";

export interface SignalRecord {
  id: string;
  competitorId: string;
  signalType: string;
  createdAt: string;
}

export function detectVelocityIncrease(signals: SignalRecord[]): PatternCandidate[] {
  return [];
}

export function detectPricingInstability(signals: SignalRecord[]): PatternCandidate[] {
  return [];
}

export function detectPositioningShiftTrend(signals: SignalRecord[]): PatternCandidate[] {
  return [];
}

export function detectFeatureAcceleration(signals: SignalRecord[]): PatternCandidate[] {
  return [];
}