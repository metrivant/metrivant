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
  | "strategy_reviewed"
  | "rivals_5"
  | "map_viewed"
  | "pressure_detected"
  | "subscribed_analyst"
  | "subscribed_pro"
  | "gravity_shift"
  | "singularity"
  | "deep_field"
  | "pattern_emergence"
  | "the_long_game"
  | "sentinel"
  | "temporal_lens"
  | "ancient_instinct";

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
    id: "rival_tracked",
    name: "Target Acquired",
    description: "Your first competitor is live on the radar.",
    points: 10,
  },
  {
    id: "signal_first",
    name: "First Contact",
    description: "Your intelligence pipeline detected its first competitive signal.",
    points: 10,
  },
  {
    id: "rivals_5",
    name: "Five Eyes",
    description: "Five or more rivals under simultaneous active surveillance.",
    points: 25,
  },
  {
    id: "brief_viewed",
    name: "Intel Reviewed",
    description: "You read your first weekly intelligence brief.",
    points: 15,
  },
  {
    id: "strategy_reviewed",
    name: "Pattern Analyst",
    description: "Cross-competitor strategic patterns examined.",
    points: 20,
  },
  {
    id: "map_viewed",
    name: "Terrain Mapped",
    description: "Competitive landscape plotted on the positioning map.",
    points: 20,
  },
  {
    id: "signals_10",
    name: "Signal Density",
    description: "10 or more competitive signals detected in 7 days.",
    points: 50,
  },
  {
    id: "pressure_detected",
    name: "Pressure Wave",
    description: "A rival reached accelerating momentum — market pressure confirmed.",
    points: 30,
  },
  {
    id: "movement_detected",
    name: "Movement Confirmed",
    description: "A strategic movement identified, confirmed, and recorded.",
    points: 75,
  },
  {
    id: "critical_alert",
    name: "Red Zone",
    description: "A competitor entered critical acceleration. Act now.",
    points: 100,
  },
  {
    id: "subscribed_analyst",
    name: "Intelligence Activated",
    description: "Activate an Analyst subscription.",
    points: 10,
  },
  {
    id: "subscribed_pro",
    name: "Full Spectrum",
    description: "Activate a Pro subscription.",
    points: 25,
  },
  {
    id: "gravity_shift",
    name: "Gravity Shift",
    description: "Activated ORBIT mode — the market bends toward mass.",
    points: 30,
  },
  {
    id: "singularity",
    name: "Singularity",
    description: "A competitor reached critical mass. The field warps around them.",
    points: 40,
  },
  {
    id: "deep_field",
    name: "Deep Field",
    description: "Ten or more rivals visible on the radar simultaneously.",
    points: 35,
  },
  {
    id: "pattern_emergence",
    name: "Pattern Emergence",
    description: "A signal constellation cluster resolved — market convergence detected.",
    points: 50,
  },
  {
    id: "the_long_game",
    name: "The Long Game",
    description: "Returned to the radar across three separate days. Intelligence compounds.",
    points: 60,
  },
  {
    id: "sentinel",
    name: "Sentinel",
    description: "Five unbroken minutes watching the field. The dedicated see what others miss.",
    points: 35,
  },
  {
    id: "temporal_lens",
    name: "Temporal Lens",
    description: "Used every time filter — past day, past week, all time — in a single session.",
    points: 30,
  },
  {
    id: "ancient_instinct",
    name: "Ancient Instinct",
    description: "Fifteen rivals tracked, movement confirmed. The oldest strategy: observe, then strike.",
    points: 75,
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
