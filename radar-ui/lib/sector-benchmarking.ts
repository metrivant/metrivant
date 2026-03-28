/**
 * Sector Benchmarking
 *
 * Compares competitor metrics against sector baselines to show
 * "above/below sector avg" indicators in UI.
 */

type SectorBaseline = {
  sector: string;
  metric_type: string;
  median_value: number;
  p75_value: number;
  p90_value: number;
  sample_size: number;
  calculated_at: string;
};

export type BenchmarkResult = {
  metric: string;
  value: number;
  median: number;
  p75: number;
  p90: number;
  status: "above_p90" | "above_p75" | "above_median" | "below_median";
  label: string;
  color: string;
};

/**
 * Compare a value against sector baseline percentiles
 */
export function compareToBaseline(
  value: number,
  baseline: Pick<SectorBaseline, "median_value" | "p75_value" | "p90_value">
): BenchmarkResult["status"] {
  if (value >= baseline.p90_value) return "above_p90";
  if (value >= baseline.p75_value) return "above_p75";
  if (value >= baseline.median_value) return "above_median";
  return "below_median";
}

/**
 * Get display label and color for benchmark status
 */
export function getBenchmarkDisplay(status: BenchmarkResult["status"]): {
  label: string;
  color: string;
  emoji: string;
} {
  switch (status) {
    case "above_p90":
      return {
        label: "Top 10%",
        color: "#ef4444", // red
        emoji: "↑↑",
      };
    case "above_p75":
      return {
        label: "Above Avg",
        color: "#f59e0b", // amber
        emoji: "↑",
      };
    case "above_median":
      return {
        label: "Above Median",
        color: "#2EE6A6", // green
        emoji: "→",
      };
    case "below_median":
      return {
        label: "Below Median",
        color: "#64748b", // slate
        emoji: "↓",
      };
  }
}

/**
 * Format metric value for display
 */
export function formatMetricValue(metric: string, value: number): string {
  switch (metric) {
    case "signals_per_week":
      return `${value.toFixed(1)}/wk`;
    case "pressure_index":
      return value.toFixed(1);
    case "hiring_velocity":
      return `${value.toFixed(0)} roles/wk`;
    case "movement_frequency":
      return `${value.toFixed(1)}/mo`;
    default:
      return value.toFixed(1);
  }
}

/**
 * Get human-readable metric name
 */
export function getMetricLabel(metric: string): string {
  switch (metric) {
    case "signals_per_week":
      return "Signal Rate";
    case "pressure_index":
      return "Pressure";
    case "hiring_velocity":
      return "Hiring";
    case "movement_frequency":
      return "Movements";
    default:
      return metric;
  }
}

/**
 * Calculate competitor's current metrics for benchmarking
 * (30-day rolling window to match baseline calculation)
 */
export function calculateCompetitorMetrics(data: {
  signalCount30d: number;
  pressureIndex: number;
  hiringCount30d: number;
  movementCount30d: number;
}): Record<string, number> {
  return {
    signals_per_week: data.signalCount30d / 4.3, // 30d ≈ 4.3 weeks
    pressure_index: data.pressureIndex,
    hiring_velocity: data.hiringCount30d / 4.3,
    movement_frequency: data.movementCount30d,
  };
}
