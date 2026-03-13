// ── Intel Score achievement system ────────────────────────────────────────────
// Definitions are static. Persistence lives in user_achievements +
// user_strategy_actions Supabase tables. Score is computed client-side.

export type AchievementId =
  | "signal_first"
  | "rival_tracked"
  | "brief_viewed"
  | "movement_detected"
  | "critical_alert"
  | "signals_10"
  | "strategy_reviewed";

export type StrategyActionId =
  | "pricing_monitor"
  | "movement_respond"
  | "counter_strategy";

export type Difficulty = "Easy" | "Medium" | "Hard";

export type Achievement = {
  id: AchievementId;
  name: string;
  description: string;
  points: number;
};

export type StrategyAction = {
  id: StrategyActionId;
  name: string;
  difficulty: Difficulty;
  points: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "signal_first",
    name: "First Signal",
    description: "Your intelligence pipeline detected its first competitive signal.",
    points: 10,
  },
  {
    id: "rival_tracked",
    name: "First Rival Tracked",
    description: "Your first competitor is live on the radar.",
    points: 10,
  },
  {
    id: "brief_viewed",
    name: "Intelligence Reviewed",
    description: "You reviewed your first weekly intelligence brief.",
    points: 15,
  },
  {
    id: "movement_detected",
    name: "Movement Confirmed",
    description: "A strategic movement has been identified and confirmed.",
    points: 75,
  },
  {
    id: "critical_alert",
    name: "Critical Acceleration",
    description: "You detected a competitor in critical strategic acceleration.",
    points: 100,
  },
  {
    id: "signals_10",
    name: "Signal Density",
    description: "10 or more competitive signals observed in your feed.",
    points: 50,
  },
  {
    id: "strategy_reviewed",
    name: "Strategy Reviewed",
    description: "You analyzed cross-competitor strategic patterns.",
    points: 20,
  },
];

export const STRATEGY_ACTIONS: StrategyAction[] = [
  {
    id: "pricing_monitor",
    name: "Monitor Competitor Pricing",
    difficulty: "Easy",
    points: 10,
  },
  {
    id: "movement_respond",
    name: "Respond to Strategic Movement",
    difficulty: "Medium",
    points: 25,
  },
  {
    id: "counter_strategy",
    name: "Launch Counter Strategy",
    difficulty: "Hard",
    points: 50,
  },
];

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  Easy:   "#2EE6A6",
  Medium: "#f59e0b",
  Hard:   "#ef4444",
};

export const MAX_INTEL_SCORE =
  ACHIEVEMENTS.reduce((s, a) => s + a.points, 0) +
  STRATEGY_ACTIONS.reduce((s, a) => s + a.points, 0);

export function computeIntelScore(
  unlockedIds: Set<string>,
  completedActionIds: Set<string>
): number {
  let score = 0;
  for (const a of ACHIEVEMENTS) {
    if (unlockedIds.has(a.id)) score += a.points;
  }
  for (const s of STRATEGY_ACTIONS) {
    if (completedActionIds.has(s.id)) score += s.points;
  }
  return score;
}
