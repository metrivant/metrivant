"use client";

import { useState } from "react";
import {
  getPatternConfig,
  confidenceColor,
  getHorizon,
  HORIZON_STYLES,
  type PatternType,
  type HorizonTier,
} from "../../../lib/strategy";

// Minimal shape — only what this component needs from InsightRow
type TimelineInsight = {
  id: string;
  pattern_type: PatternType;
  strategic_signal: string;
  confidence: number;
  competitor_count: number;
  competitors_involved: string[];
  is_major: boolean;
  created_at: string;
};

type Props = {
  insights: TimelineInsight[];
};

export default function StrategyTimeline({ insights }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  // Build sorted list of competitors, ranked by pattern frequency
  const competitors = Array.from(
    insights
      .flatMap((i) => i.competitors_involved)
      .reduce((map, name) => {
        map.set(name, (map.get(name) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
      .entries()
  )
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  if (competitors.length === 0) return null;

  const timeline = selected
    ? insights
        .filter((i) => i.competitors_involved.includes(selected))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  return (
    <section>
      {/* Section header */}
      <div className="mb-6">
        <div className="flex items-end gap-4">
          <div className="flex items-baseline gap-3">
            <span
              className="font-mono text-[11px] font-bold"
              style={{ color: "rgba(0,180,255,0.40)" }}
            >
              04
            </span>
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              Competitor Timeline
            </h2>
          </div>
          <div
            className="mb-1 h-px flex-1"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,180,255,0.18) 0%, transparent 100%)",
            }}
          />
        </div>
        <p className="mt-1 text-[12px] text-slate-600">
          Pattern history per competitor · select to expand
        </p>
      </div>

      {/* Competitor selector pills */}
      <div className="mb-5 flex flex-wrap gap-2">
        {competitors.map((name) => (
          <button
            key={name}
            onClick={() => setSelected(selected === name ? null : name)}
            className="rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-150"
            style={{
              borderColor:
                selected === name
                  ? "rgba(0,180,255,0.40)"
                  : "#0e1e0e",
              background:
                selected === name
                  ? "rgba(0,180,255,0.08)"
                  : "#020208",
              color: selected === name ? "#00B4FF" : "#64748b",
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Timeline for selected competitor */}
      {selected && timeline.length > 0 && (
        <div className="relative pl-8">
          {/* Vertical rule */}
          <div
            className="absolute left-[7px] top-1 bottom-2 w-px"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,180,255,0.18) 0%, transparent 100%)",
            }}
          />
          <div className="flex flex-col gap-5">
            {timeline.map((insight) => {
              const cfg = getPatternConfig(insight.pattern_type);
              const confColor = confidenceColor(insight.confidence);
              const confPct = Math.round(insight.confidence * 100);
              const horizon = getHorizon(insight.created_at, insight.confidence);
              const horizonColor = HORIZON_STYLES[horizon].color;
              const dateStr = new Date(insight.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div key={insight.id} className="relative">
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-[25px] top-1.5 h-[9px] w-[9px] rounded-full border"
                    style={{
                      backgroundColor: `${cfg.color}22`,
                      borderColor: `${cfg.color}44`,
                    }}
                  >
                    <div
                      className="absolute inset-[2px] rounded-full"
                      style={{ backgroundColor: cfg.color }}
                    />
                  </div>

                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-700">{dateStr}</span>
                    <span className="text-slate-800">·</span>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{ color: horizonColor, background: `${horizonColor}12` }}
                    >
                      {horizon}
                    </span>
                    {insight.is_major && (
                      <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400">
                        Major
                      </span>
                    )}
                  </div>

                  <p className="text-[13px] font-medium leading-snug text-slate-200">
                    {insight.strategic_signal}
                  </p>

                  {/* Confidence bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-[#0d1f0d]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${confPct}%`,
                          backgroundColor: confColor,
                          boxShadow: `0 0 4px ${confColor}44`,
                        }}
                      />
                    </div>
                    <span
                      className="font-mono text-[10px] tabular-nums"
                      style={{ color: confColor }}
                    >
                      {confPct}%
                    </span>
                    <span className="text-[10px] text-slate-700">
                      {insight.competitor_count} rival{insight.competitor_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && timeline.length === 0 && (
        <p className="text-[12px] text-slate-600">
          No pattern timeline found for {selected}.
        </p>
      )}
    </section>
  );
}
