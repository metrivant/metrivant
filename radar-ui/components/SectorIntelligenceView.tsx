"use client";

/**
 * Sector Intelligence View
 *
 * Displays sector-wide intelligence analysis:
 * - Sector trends and patterns
 * - Divergences (competitors breaking from sector norms)
 * - Comparative positioning
 * - Recent activity heatmap
 */

import { translateMovementType, translateSignalType, getSectorLabel } from "../lib/sectors";

type SectorIntelligence = {
  id: string;
  org_id: string;
  sector: string;
  summary: string | null;
  sector_trends: {
    trend: string;
    competitors: string[];
    confidence: number;
  }[] | null;
  divergences: {
    competitor_id: string;
    divergence: string;
    significance: string;
  }[] | null;
  created_at: string;
};

type Competitor = {
  id: string;
  name: string;
  website_url: string;
};

type Signal = {
  signal_type: string;
  competitor_id: string;
  detected_at: string;
  confidence_score: number | null;
};

type Movement = {
  movement_type: string;
  competitor_id: string;
  confidence: number | null;
  last_seen_at: string;
};

type Props = {
  sector: string;
  intelligence: SectorIntelligence | null;
  competitors: Competitor[];
  recentSignals: Signal[];
  recentMovements: Movement[];
};

export default function SectorIntelligenceView({
  sector,
  intelligence,
  competitors,
  recentSignals,
  recentMovements,
}: Props) {
  const sectorLabel = getSectorLabel(sector);
  const competitorMap = new Map(competitors.map((c) => [c.id, c]));

  // Calculate signal density per competitor
  const signalDensity = new Map<string, number>();
  recentSignals.forEach((s) => {
    signalDensity.set(s.competitor_id, (signalDensity.get(s.competitor_id) ?? 0) + 1);
  });

  // Calculate movement density per competitor
  const movementDensity = new Map<string, number>();
  recentMovements.forEach((m) => {
    movementDensity.set(m.competitor_id, (movementDensity.get(m.competitor_id) ?? 0) + 1);
  });

  // Get most active competitors
  const activeCompetitors = [...signalDensity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ competitor: competitorMap.get(id), count }))
    .filter((item) => item.competitor);

  // Signal type distribution
  const signalTypeDistribution = new Map<string, number>();
  recentSignals.forEach((s) => {
    signalTypeDistribution.set(s.signal_type, (signalTypeDistribution.get(s.signal_type) ?? 0) + 1);
  });

  const topSignalTypes = [...signalTypeDistribution.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Movement type distribution
  const movementTypeDistribution = new Map<string, number>();
  recentMovements.forEach((m) => {
    movementTypeDistribution.set(m.movement_type, (movementTypeDistribution.get(m.movement_type) ?? 0) + 1);
  });

  const topMovementTypes = [...movementTypeDistribution.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const trends = intelligence?.sector_trends ?? [];
  const divergences = intelligence?.divergences ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#020817]">
      {/* Header */}
      <div className="shrink-0 border-b border-[#0e1022] bg-[rgba(0,0,0,0.4)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-[#00B4FF]">
              Sector Intelligence
            </h1>
            <p className="mt-1 font-mono text-xs text-slate-400">
              {sectorLabel} • Cross-competitor analysis • Last 30 days
            </p>
          </div>
          {intelligence && (
            <div className="text-right font-mono text-xs text-slate-500">
              Generated {new Date(intelligence.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {!intelligence ? (
            <div className="rounded-lg border border-[#0e1022] bg-[rgba(0,0,0,0.3)] p-8 text-center">
              <div className="font-mono text-sm text-slate-400">
                No sector intelligence generated yet
              </div>
              <div className="mt-2 font-mono text-xs text-slate-500">
                Sector analysis runs Monday/Wednesday/Friday at 07:00 UTC
              </div>
            </div>
          ) : (
            <>
              {/* Summary */}
              {intelligence.summary && (
                <div className="rounded-lg border border-[#0e1022] bg-[rgba(0,0,0,0.3)] p-6">
                  <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    Sector Summary
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {intelligence.summary}
                  </p>
                </div>
              )}

              {/* Trends */}
              {trends.length > 0 && (
                <div className="rounded-lg border border-[#0e1022] bg-[rgba(0,0,0,0.3)] p-6">
                  <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    Sector Trends
                  </h2>
                  <div className="space-y-4">
                    {trends.map((trend, i) => (
                      <div
                        key={i}
                        className="border-l-2 border-[#00B4FF] pl-4"
                      >
                        <div className="mb-2 flex items-center gap-3">
                          <div className="text-sm font-medium text-slate-200">
                            {trend.trend}
                          </div>
                          <div
                            className="rounded px-2 py-0.5 font-mono text-xs"
                            style={{
                              background: `rgba(0,180,255,${trend.confidence * 0.15})`,
                              color: "#00B4FF",
                            }}
                          >
                            {Math.round(trend.confidence * 100)}% confidence
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trend.competitors.map((compId) => {
                            const comp = competitorMap.get(compId);
                            return comp ? (
                              <div
                                key={compId}
                                className="rounded bg-[rgba(100,116,139,0.15)] px-2 py-1 font-mono text-xs text-slate-400"
                              >
                                {comp.name}
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divergences */}
              {divergences.length > 0 && (
                <div className="rounded-lg border border-[#0e1022] bg-[rgba(0,0,0,0.3)] p-6">
                  <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    Divergences
                    <span className="ml-2 text-[10px] font-normal text-slate-500">
                      Competitors breaking from sector patterns
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {divergences.map((div, i) => {
                      const comp = competitorMap.get(div.competitor_id);
                      if (!comp) return null;

                      const significanceColor =
                        div.significance === "high"
                          ? "#ef4444"
                          : div.significance === "medium"
                            ? "#f59e0b"
                            : "#64748b";

                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded border border-[rgba(100,116,139,0.2)] bg-[rgba(0,0,0,0.2)] p-3"
                        >
                          <div
                            className="mt-1 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: significanceColor }}
                          />
                          <div className="flex-1">
                            <div className="mb-1 font-mono text-xs font-medium text-slate-300">
                              {comp.name}
                            </div>
                            <div className="text-sm text-slate-400">
                              {div.divergence}
                            </div>
                          </div>
                          <div
                            className="shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                            style={{
                              background: `${significanceColor}20`,
                              color: significanceColor,
                            }}
                          >
                            {div.significance}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Activity Heatmap */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Signal Activity */}
            <div className="rounded-lg border border-[#0e1022] bg-[rgba(0,0,0,0.3)] p-6">
              <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Signal Activity
                <span className="ml-2 text-[10px] font-normal text-slate-500">
                  {recentSignals.length} signals • Last 30d
                </span>
              </h2>
              {topSignalTypes.length === 0 ? (
                <div className="py-4 text-center font-mono text-xs text-slate-500">
                  No signals detected
                </div>
              ) : (
                <div className="space-y-2">
                  {topSignalTypes.map(([type, count]) => {
                    const maxCount = topSignalTypes[0][1];
                    const percentage = (count / maxCount) * 100;
                    return (
                      <div key={type}>
                        <div className="mb-1 flex items-center justify-between font-mono text-xs">
                          <span className="text-slate-300">
                            {translateSignalType(type, sector)}
                          </span>
                          <span className="text-slate-500">{count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(100,116,139,0.2)]">
                          <div
                            className="h-full rounded-full bg-[#00B4FF]"
                            style={{
                              width: `${percentage}%`,
                              opacity: 0.6 + (percentage / 100) * 0.4,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Movement Activity */}
            <div className="rounded-lg border border-[#0e1022] bg-[rgba(0,0,0,0.3)] p-6">
              <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Strategic Movements
                <span className="ml-2 text-[10px] font-normal text-slate-500">
                  {recentMovements.length} movements • Last 30d
                </span>
              </h2>
              {topMovementTypes.length === 0 ? (
                <div className="py-4 text-center font-mono text-xs text-slate-500">
                  No movements detected
                </div>
              ) : (
                <div className="space-y-2">
                  {topMovementTypes.map(([type, count]) => {
                    const maxCount = topMovementTypes[0][1];
                    const percentage = (count / maxCount) * 100;
                    return (
                      <div key={type}>
                        <div className="mb-1 flex items-center justify-between font-mono text-xs">
                          <span className="text-slate-300">
                            {translateMovementType(type, sector)}
                          </span>
                          <span className="text-slate-500">{count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(100,116,139,0.2)]">
                          <div
                            className="h-full rounded-full bg-[#2EE6A6]"
                            style={{
                              width: `${percentage}%`,
                              opacity: 0.6 + (percentage / 100) * 0.4,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Most Active Competitors */}
          {activeCompetitors.length > 0 && (
            <div className="rounded-lg border border-[#0e1022] bg-[rgba(0,0,0,0.3)] p-6">
              <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Most Active Competitors
                <span className="ml-2 text-[10px] font-normal text-slate-500">
                  By signal count • Last 30d
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeCompetitors.map((item) => {
                  if (!item.competitor) return null;
                  const movements = movementDensity.get(item.competitor.id) ?? 0;
                  return (
                    <div
                      key={item.competitor.id}
                      className="flex items-center justify-between rounded border border-[rgba(100,116,139,0.2)] bg-[rgba(0,0,0,0.2)] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-xs font-medium text-slate-300">
                          {item.competitor.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                          {movements} {movements === 1 ? "movement" : "movements"}
                        </div>
                      </div>
                      <div className="ml-3 shrink-0 rounded bg-[rgba(0,180,255,0.15)] px-2 py-1 font-mono text-xs font-bold text-[#00B4FF]">
                        {item.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
