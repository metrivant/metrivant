"use client";

/**
 * Pipeline Visualization — Sector-Aware Intelligence Flow
 *
 * Brand new aesthetic showing deterministic signal flow with sector amplification.
 * Monochrome/minimal design matching Discover and Telescope redesigns.
 */

import { getSectorConfig } from "../lib/sector-config";
import type { SectorId } from "../lib/sector-config";

type PipelineMetrics = {
  competitors: number;
  pages: number;
  signals_7d: number;
  movements_14d: number;
};

type Props = {
  sector: string;
  metrics: PipelineMetrics;
};

const STAGES = [
  { id: "competitors", label: "Competitors", icon: "◆", amplified: false },
  { id: "pages", label: "Monitored Pages", icon: "◇", amplified: false },
  { id: "snapshots", label: "Snapshots", icon: "□", amplified: false },
  { id: "sections", label: "Sections", icon: "▭", amplified: false },
  { id: "baselines", label: "Baselines", icon: "▬", amplified: false },
  { id: "diffs", label: "Diffs", icon: "≟", amplified: false },
  { id: "signals", label: "Signals", icon: "◉", amplified: true },
  { id: "interpretations", label: "Interpretations", icon: "◎", amplified: true },
  { id: "movements", label: "Movements", icon: "◈", amplified: true },
  { id: "radar", label: "Radar Feed", icon: "⬢", amplified: false },
] as const;

const POOLS = [
  { id: "newsroom", label: "Newsroom", source: "RSS" },
  { id: "careers", label: "Careers", source: "ATS" },
  { id: "investor", label: "Investor", source: "SEC" },
  { id: "product", label: "Product", source: "RSS" },
  { id: "procurement", label: "Procurement", source: "Gov" },
  { id: "regulatory", label: "Regulatory", source: "SEC" },
] as const;

export default function PipelineVisualization({ sector, metrics }: Props) {
  const sectorConfig = getSectorConfig(sector);
  const sectorLabel = sectorConfig.label;

  // Get top 3 amplified signals for this sector
  const signalWeights = Object.entries(sectorConfig.signalWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // Get top 3 amplified pools for this sector
  const poolWeights = Object.entries(sectorConfig.poolWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Grain texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <div className="mb-16">
          <div className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-slate-600">
            System Pipeline
          </div>
          <h1 className="font-mono text-[28px] font-light tracking-tight text-white">
            Intelligence Flow
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-slate-500">
              Sector
            </div>
            <div className="rounded border border-slate-800 bg-slate-950 px-3 py-1 font-mono text-[12px] font-medium text-white">
              {sectorLabel}
            </div>
          </div>
        </div>

        {/* Pipeline Flow */}
        <div className="mb-20">
          <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
            Detection Pipeline · Deterministic
          </div>

          <div className="space-y-0">
            {STAGES.map((stage, i) => (
              <div key={stage.id} className="relative">
                {/* Connector line */}
                {i < STAGES.length - 1 && (
                  <div className="absolute left-[18px] top-[44px] h-[20px] w-px bg-slate-900" />
                )}

                <div className="flex items-start gap-4">
                  {/* Stage icon */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border font-mono text-[16px] ${
                      stage.amplified
                        ? "border-slate-700 bg-slate-950 text-slate-400"
                        : "border-slate-900 bg-black text-slate-700"
                    }`}
                  >
                    {stage.icon}
                  </div>

                  {/* Stage info */}
                  <div className="flex min-w-0 flex-1 items-center justify-between py-2">
                    <div>
                      <div className="font-mono text-[13px] font-medium text-white">
                        {stage.label}
                      </div>
                      {stage.amplified && (
                        <div className="mt-0.5 font-mono text-[10px] tracking-wide text-slate-600">
                          Sector-weighted
                        </div>
                      )}
                    </div>

                    {/* Metric */}
                    {stage.id === "competitors" && (
                      <div className="font-mono text-[13px] tabular-nums text-slate-500">
                        {metrics.competitors}
                      </div>
                    )}
                    {stage.id === "pages" && (
                      <div className="font-mono text-[13px] tabular-nums text-slate-500">
                        {metrics.pages}
                      </div>
                    )}
                    {stage.id === "signals" && (
                      <div className="font-mono text-[13px] tabular-nums text-slate-400">
                        {metrics.signals_7d} <span className="text-slate-700">/7d</span>
                      </div>
                    )}
                    {stage.id === "movements" && (
                      <div className="font-mono text-[13px] tabular-nums text-slate-400">
                        {metrics.movements_14d} <span className="text-slate-700">/14d</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sector Amplification */}
        <div className="mb-20 grid gap-12 md:grid-cols-2">
          {/* Signal Amplification */}
          <div>
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
              Signal Amplification
            </div>
            <div className="space-y-2">
              {signalWeights.map(([type, weight]) => (
                <div
                  key={type}
                  className="flex items-center justify-between border-l-2 border-slate-800 bg-slate-950/30 px-4 py-2.5"
                >
                  <div className="font-mono text-[11px] text-slate-400">
                    {type.replace(/_/g, " ")}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-[12px] font-bold tabular-nums text-white">
                      {weight.toFixed(1)}×
                    </div>
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full bg-slate-600"
                        style={{ width: `${(weight / 2.5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 font-mono text-[9px] text-slate-700">
              Top 3 critical signals for {sectorLabel}
            </div>
          </div>

          {/* Pool Amplification */}
          <div>
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
              Pool Weighting
            </div>
            <div className="space-y-2">
              {poolWeights.map(([type, weight]) => (
                <div
                  key={type}
                  className="flex items-center justify-between border-l-2 border-slate-800 bg-slate-950/30 px-4 py-2.5"
                >
                  <div className="font-mono text-[11px] text-slate-400">
                    {type}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-[12px] font-bold tabular-nums text-white">
                      {weight.toFixed(1)}×
                    </div>
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full bg-slate-600"
                        style={{ width: `${(weight / 8.0) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 font-mono text-[9px] text-slate-700">
              Top 3 priority pools for {sectorLabel}
            </div>
          </div>
        </div>

        {/* Additive Pools */}
        <div className="mb-20">
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
            Additive Intelligence Pools
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {POOLS.map((pool) => {
              const weight = sectorConfig.poolWeights[pool.id as keyof typeof sectorConfig.poolWeights] ?? 1.0;
              const isHigh = weight >= 5.0;
              return (
                <div
                  key={pool.id}
                  className={`flex items-center justify-between rounded-sm border px-4 py-3 ${
                    isHigh
                      ? "border-slate-700 bg-slate-950"
                      : "border-slate-900 bg-black"
                  }`}
                >
                  <div>
                    <div
                      className={`font-mono text-[12px] font-medium ${
                        isHigh ? "text-white" : "text-slate-600"
                      }`}
                    >
                      {pool.label}
                    </div>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-700">
                      {pool.source}
                    </div>
                  </div>
                  <div
                    className={`font-mono text-[10px] tabular-nums ${
                      isHigh ? "text-slate-500" : "text-slate-800"
                    }`}
                  >
                    {weight.toFixed(1)}×
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Stack */}
        <div>
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">
            AI Interpretation Stack
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-slate-900 bg-black px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[12px] text-slate-500">Relevance</div>
                <div className="font-mono text-[10px] text-slate-700">gpt-4o-mini</div>
              </div>
              <div className="mt-1 font-mono text-[9px] text-slate-800">
                Pre-classification · high/medium/low
              </div>
            </div>

            <div className="rounded-sm border border-slate-800 bg-slate-950/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[12px] text-slate-400">Interpretation</div>
                <div className="font-mono text-[10px] text-slate-700">gpt-4o-mini</div>
              </div>
              <div className="mt-1 font-mono text-[9px] text-slate-700">
                Sector-aware · signal analysis
              </div>
            </div>

            <div className="rounded-sm border border-slate-800 bg-slate-950/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[12px] text-slate-400">Synthesis</div>
                <div className="font-mono text-[10px] text-slate-700">gpt-4o</div>
              </div>
              <div className="mt-1 font-mono text-[9px] text-slate-700">
                Sector-aware · movement narratives
              </div>
            </div>

            <div className="rounded-sm border border-slate-900 bg-black px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[12px] text-slate-500">Narrative</div>
                <div className="font-mono text-[10px] text-slate-700">gpt-4o-mini</div>
              </div>
              <div className="mt-1 font-mono text-[9px] text-slate-800">
                Activity explanations · per competitor
              </div>
            </div>

            <div className="rounded-sm border border-slate-900 bg-black px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[12px] text-slate-500">Sector Analysis</div>
                <div className="font-mono text-[10px] text-slate-700">gpt-4o</div>
              </div>
              <div className="mt-1 font-mono text-[9px] text-slate-800">
                Cross-competitor patterns · weekly
              </div>
            </div>

            <div className="rounded-sm border border-slate-900 bg-black px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[12px] text-slate-500">Weekly Brief</div>
                <div className="font-mono text-[10px] text-slate-700">gpt-4o</div>
              </div>
              <div className="mt-1 font-mono text-[9px] text-slate-800">
                Intelligence digest · Monday 10:00
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-16 border-t border-slate-900 pt-6">
          <div className="font-mono text-[10px] text-slate-700">
            Pipeline runs deterministically · Sector weighting amplifies {sectorLabel}-critical signals
            · All stages observable via Sentry + pipeline_events
          </div>
        </div>
      </div>
    </div>
  );
}
