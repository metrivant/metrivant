/**
 * Novelty Display Helpers (Frontend)
 *
 * UI helpers for displaying novelty scores. Mirrors logic from
 * lib/compute-novelty.ts (runtime surface) but kept separate for
 * surface isolation.
 */

export type NoveltyBadge = {
  label: string;
  color: string;
  symbol: string;
  shouldDisplay: boolean;
};

/**
 * Get novelty display configuration for UI rendering.
 *
 * @param noveltyScore - Signal novelty score (0.0-1.0)
 * @returns Badge configuration (label, color, symbol, shouldDisplay)
 */
export function getNoveltyDisplay(noveltyScore: number | null): NoveltyBadge {
  if (noveltyScore === null || noveltyScore < 0.5) {
    return {
      label: "Operational",
      color: "#475569", // slate-600
      symbol: "·",
      shouldDisplay: false, // Don't show badge for operational patterns
    };
  }

  if (noveltyScore >= 0.8) {
    return {
      label: "First-time",
      color: "#2EE6A6", // green - high value signal
      symbol: "✦",
      shouldDisplay: true,
    };
  }

  return {
    label: "Recurring",
    color: "#f59e0b", // amber - medium novelty
    symbol: "↻",
    shouldDisplay: true,
  };
}
