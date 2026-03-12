import type { RadarCompetitor } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LemonHeat = "cold" | "warm" | "hot";

export type LemonSignal = {
  emoji: string;
  short: string;    // 2-3 word label shown on card
  bubble: string;   // full speech bubble sentence
  color: string;    // accent color
  heat: LemonHeat;
};

// ─── Movement → Lemonade translation map ─────────────────────────────────────

type MovementTranslation = {
  emoji: string;
  short: string;
  getBubble: (name: string) => string;
  color: string;
};

const MOVEMENT_MAP: Record<string, MovementTranslation> = {
  pricing_strategy_shift: {
    emoji: "🏷️",
    short: "changed price",
    getBubble: (n) => `${n} is selling cheaper lemonade!`,
    color: "#f87171",
  },
  product_expansion: {
    emoji: "🍓",
    short: "new flavour",
    getBubble: (n) => `${n} just added a new flavour!`,
    color: "#60a5fa",
  },
  market_reposition: {
    emoji: "📋",
    short: "new sign",
    getBubble: (n) => `${n} put up a brand new sign`,
    color: "#34d399",
  },
  enterprise_push: {
    emoji: "⭐",
    short: "fancy section",
    getBubble: (n) => `${n} opened a VIP tent`,
    color: "#a78bfa",
  },
  ecosystem_expansion: {
    emoji: "🏪",
    short: "more stands",
    getBubble: (n) => `${n} is opening more stands!`,
    color: "#fb923c",
  },
};

// ─── Translate ────────────────────────────────────────────────────────────────

export function translateToLemon(competitor: RadarCompetitor): LemonSignal {
  const momentum = Number(competitor.momentum_score ?? 0);
  const heat: LemonHeat =
    momentum >= 5 ? "hot" : momentum >= 2 ? "warm" : "cold";

  if (!competitor.latest_movement_type) {
    return {
      emoji: "😴",
      short: "nothing new",
      bubble: `${competitor.competitor_name} hasn't changed anything lately`,
      color: "#d1d5db",
      heat: "cold",
    };
  }

  const m = MOVEMENT_MAP[competitor.latest_movement_type];
  if (!m) {
    return {
      emoji: "📣",
      short: "something new",
      bubble: `${competitor.competitor_name} is up to something`,
      color: "#2ee6a6",
      heat,
    };
  }

  return {
    emoji: m.emoji,
    short: m.short,
    bubble: m.getBubble(competitor.competitor_name),
    color: m.color,
    heat,
  };
}

// ─── Stand colors — one per competitor slot ───────────────────────────────────

const STAND_COLORS = ["#f87171", "#60a5fa", "#34d399", "#a78bfa", "#fb923c"] as const;

export function standColor(index: number): string {
  return STAND_COLORS[index % STAND_COLORS.length];
}
