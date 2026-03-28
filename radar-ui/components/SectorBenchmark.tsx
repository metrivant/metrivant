"use client";

/**
 * Sector Benchmark Badge
 *
 * Displays "above/below sector avg" indicator for a competitor metric.
 * Used in intelligence drawer and competitor cards.
 */

import { getBenchmarkDisplay, getMetricLabel, formatMetricValue } from "../lib/sector-benchmarking";
import type { BenchmarkResult } from "../lib/sector-benchmarking";

type Props = {
  metric: string;
  value: number;
  status: BenchmarkResult["status"];
  compact?: boolean; // If true, show minimal badge; if false, show full stats
};

export default function SectorBenchmark({ metric, value, status, compact = false }: Props) {
  const display = getBenchmarkDisplay(status);
  const metricLabel = getMetricLabel(metric);
  const formattedValue = formatMetricValue(metric, value);

  if (compact) {
    // Compact badge for cards
    return (
      <div
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
        style={{
          background: `${display.color}20`,
          color: display.color,
        }}
        title={`${metricLabel}: ${display.label} for sector`}
      >
        <span>{display.emoji}</span>
        <span>{display.label}</span>
      </div>
    );
  }

  // Full stats for drawer
  return (
    <div className="flex items-center justify-between rounded border border-[rgba(100,116,139,0.2)] bg-[rgba(0,0,0,0.2)] p-2">
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 items-center justify-center rounded font-mono text-sm"
          style={{
            background: `${display.color}20`,
            color: display.color,
          }}
        >
          {display.emoji}
        </div>
        <div>
          <div className="font-mono text-xs font-medium text-slate-300">
            {metricLabel}
          </div>
          <div className="font-mono text-[10px] text-slate-500">
            {display.label} for sector
          </div>
        </div>
      </div>
      <div
        className="font-mono text-sm font-bold"
        style={{ color: display.color }}
      >
        {formattedValue}
      </div>
    </div>
  );
}

/**
 * Sector Benchmark List
 *
 * Displays multiple benchmark metrics in a grid
 */
type ListProps = {
  benchmarks: Array<{
    metric: string;
    value: number;
    status: BenchmarkResult["status"];
  }>;
};

export function SectorBenchmarkList({ benchmarks }: ListProps) {
  if (benchmarks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        Sector Benchmarks
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {benchmarks.map((b) => (
          <SectorBenchmark
            key={b.metric}
            metric={b.metric}
            value={b.value}
            status={b.status}
            compact={false}
          />
        ))}
      </div>
    </div>
  );
}
