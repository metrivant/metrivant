"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "../lib/supabase/client";
import {
  getPatternConfig,
  confidenceColor,
  type PatternType,
} from "../lib/strategy";
import type { RadarCompetitor } from "../lib/api";
import type { BriefContent } from "../lib/brief";
import MarketMap, { type MapCompetitor } from "../app/app/market-map/MarketMap";

// ── Types ─────────────────────────────────────────────────────────────────────

type OverlayType = "map" | "briefs" | "strategy" | null;

type WeeklyBrief = {
  id: string;
  generated_at: string;
  content: BriefContent;
  signal_count: number;
};

type InsightRow = {
  id: string;
  pattern_type: PatternType;
  strategic_signal: string;
  description: string;
  recommended_response: string;
  confidence: number;
  competitor_count: number;
  competitors_involved: string[];
  is_major: boolean;
  created_at: string;
};

// ── Shared UI ─────────────────────────────────────────────────────────────────

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#1a3020] bg-[#070d07] transition-colors hover:border-[#2a4a30] hover:text-[#2EE6A6]"
      style={{ color: "rgba(46,230,166,0.55)" }}
      aria-label="Close overlay"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function OverlayAccentLine() {
  return (
    <div
      className="absolute inset-x-0 top-0 h-[1px]"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.28) 40%, rgba(46,230,166,0.42) 50%, rgba(46,230,166,0.28) 60%, transparent 100%)",
      }}
    />
  );
}

const PANEL_HEADER =
  "relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-[#0e2210] px-5";

// ── Market Map Overlay ─────────────────────────────────────────────────────────

function MapOverlay({
  competitors,
  onClose,
}: {
  competitors: RadarCompetitor[];
  onClose: () => void;
}) {
  const [mapData, setMapData] = useState<MapCompetitor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError(true);
          return;
        }

        const { data: orgRows } = await supabase
          .from("organizations")
          .select("id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1);
        const org = orgRows?.[0] ?? null;

        if (!org) {
          setMapData([]);
          return;
        }

        const [{ data: positioning }, { data: history }] = await Promise.all([
          supabase
            .from("competitor_positioning")
            .select(
              "competitor_id, competitor_name, market_focus_score, customer_segment_score, confidence, rationale, updated_at"
            )
            .eq("org_id", org.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("positioning_history")
            .select(
              "competitor_id, market_focus_score, customer_segment_score, recorded_at"
            )
            .eq("org_id", org.id)
            .order("recorded_at", { ascending: false })
            .limit(300),
        ]);

        if (cancelled) return;

        if (!positioning) {
          setMapData([]);
          return;
        }

        // Group history by competitor_id (max 10 entries each)
        type HistPt = {
          market_focus_score: number;
          customer_segment_score: number;
          recorded_at: string;
        };
        const historyMap = new Map<string, HistPt[]>();
        for (const h of history ?? []) {
          const id = h.competitor_id as string;
          const arr = historyMap.get(id) ?? [];
          if (arr.length < 10) {
            arr.push({
              market_focus_score: Number(h.market_focus_score),
              customer_segment_score: Number(h.customer_segment_score),
              recorded_at: h.recorded_at as string,
            });
            historyMap.set(id, arr);
          }
        }

        // Enrich with radar feed data
        const radarMap = new Map(competitors.map((c) => [c.competitor_id, c]));

        const mapped: MapCompetitor[] = (
          positioning as unknown as Array<{
            competitor_id: string;
            competitor_name: string;
            market_focus_score: number;
            customer_segment_score: number;
            confidence: number;
            rationale: string | null;
          }>
        ).map((p) => {
          const radar = radarMap.get(p.competitor_id);
          return {
            competitor_id: p.competitor_id,
            competitor_name: p.competitor_name,
            market_focus_score: Number(p.market_focus_score),
            customer_segment_score: Number(p.customer_segment_score),
            confidence: Number(p.confidence),
            rationale: p.rationale,
            momentum_score: Number(radar?.momentum_score ?? 0),
            signals_7d: Number(radar?.signals_7d ?? 0),
            latest_movement_type: radar?.latest_movement_type ?? null,
            website_url: radar?.website_url ?? null,
            history: historyMap.get(p.competitor_id) ?? [],
          };
        });

        setMapData(mapped);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [competitors]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col bg-[#000200]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Atmospheric depth */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.016,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(46,230,166,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className={PANEL_HEADER} style={{ background: "rgba(0,0,0,0.98)" }}>
        <OverlayAccentLine />
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Market Map
          </span>
          <span style={{ color: "rgba(46,230,166,0.25)" }}>·</span>
          <span className="text-[10px] text-slate-600">
            Competitive positioning
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-600">ESC to close</span>
          <CloseButton onClose={onClose} />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
              Loading positioning data…
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-[11px] text-slate-600">
              Could not load market map.
            </div>
          </div>
        ) : !mapData || mapData.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
                No positioning data yet
              </div>
              <div className="mt-1 text-[10px] text-slate-700">
                Run positioning analysis to populate the map.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <MarketMap competitors={mapData} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Briefs Overlay ─────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#64748b",
};

function BriefsOverlay({ onClose }: { onClose: () => void }) {
  const [briefs, setBriefs] = useState<WeeklyBrief[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error: dbErr } = await supabase
          .from("weekly_briefs")
          .select("id, generated_at, content, signal_count")
          .order("generated_at", { ascending: false })
          .limit(6);
        if (cancelled) return;
        if (dbErr) {
          setError(true);
        } else {
          setBriefs((data ?? []) as WeeklyBrief[]);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = briefs?.[0] ?? null;

  return (
    <motion.div
      className="fixed inset-y-0 right-0 z-[100] flex w-[500px] flex-col border-l border-[#0e2210] bg-[#000200]"
      style={{ boxShadow: "-20px 0 60px rgba(0,0,0,0.75)" }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(46,230,166,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className={PANEL_HEADER}>
        <OverlayAccentLine />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Intelligence Briefs
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-600">ESC to close</span>
          <CloseButton onClose={onClose} />
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
              Loading briefs…
            </div>
          </div>
        ) : error ? (
          <div className="text-[11px] text-slate-600">
            Could not load briefs.
          </div>
        ) : !latest ? (
          <div className="py-12 text-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
              No briefs yet
            </div>
            <div className="mt-1 text-[10px] text-slate-700">
              Briefs are generated weekly from detected signals.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Latest brief headline */}
            <div
              className="rounded-[12px] border border-[#1a3020] px-4 py-3.5"
              style={{ background: "#070d07" }}
            >
              <div
                className="mb-2 text-[9px] font-semibold uppercase tracking-[0.24em]"
                style={{ color: "rgba(46,230,166,0.55)" }}
              >
                Latest Brief ·{" "}
                {new Date(latest.generated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <p className="text-[13px] font-medium leading-relaxed text-slate-200">
                {latest.content.headline}
              </p>
              <div className="mt-2 text-[10px] text-slate-600">
                {latest.signal_count} signal
                {latest.signal_count !== 1 ? "s" : ""} analyzed
              </div>
            </div>

            {/* Major moves */}
            {latest.content.major_moves.length > 0 && (
              <div>
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                  Major Moves
                </div>
                <div className="space-y-2">
                  {latest.content.major_moves.map((m, i) => (
                    <div
                      key={i}
                      className="rounded-[10px] border border-[#0f1c0f] bg-[#040904] px-3.5 py-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                          style={{
                            color: SEVERITY_COLORS[m.severity] ?? "#64748b",
                            background: `${SEVERITY_COLORS[m.severity] ?? "#64748b"}18`,
                          }}
                        >
                          {m.severity}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-300">
                          {m.competitor}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-500">
                        {m.move}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended actions */}
            {latest.content.recommended_actions.length > 0 && (
              <div>
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                  Recommended Actions
                </div>
                <div className="space-y-2">
                  {latest.content.recommended_actions.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-[10px] border border-[#0f1c0f] bg-[#040904] px-3.5 py-3"
                    >
                      <span
                        className="mt-0.5 text-[10px]"
                        style={{ color: "rgba(46,230,166,0.45)" }}
                      >
                        →
                      </span>
                      <p className="text-[11px] leading-snug text-slate-400">
                        {a.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Older briefs */}
            {briefs!.length > 1 && (
              <div>
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                  Previous Briefs
                </div>
                <div className="space-y-1.5">
                  {briefs!.slice(1).map((b) => (
                    <div
                      key={b.id}
                      className="rounded-[8px] border border-[#0f1c0f] bg-[#040904] px-3 py-2.5"
                    >
                      <div className="text-[9px] text-slate-600">
                        {new Date(b.generated_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                        {b.content.headline}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Strategy Overlay ───────────────────────────────────────────────────────────

function StrategyOverlay({ onClose }: { onClose: () => void }) {
  const [insights, setInsights] = useState<InsightRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error: dbErr } = await supabase
          .from("strategic_insights")
          .select(
            "id, pattern_type, strategic_signal, description, " +
            "recommended_response, confidence, competitor_count, " +
            "competitors_involved, is_major, created_at"
          )
          .order("created_at", { ascending: false })
          .order("is_major", { ascending: false })
          .order("confidence", { ascending: false })
          .limit(10);
        if (cancelled) return;
        if (dbErr) {
          setError(true);
        } else {
          setInsights((data ?? []) as unknown as InsightRow[]);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-y-0 right-0 z-[100] flex w-[500px] flex-col border-l border-[#0e2210] bg-[#000200]"
      style={{ boxShadow: "-20px 0 60px rgba(0,0,0,0.75)" }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(46,230,166,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className={PANEL_HEADER}>
        <OverlayAccentLine />
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Strategic Patterns
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-600">ESC to close</span>
          <CloseButton onClose={onClose} />
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
              Loading patterns…
            </div>
          </div>
        ) : error ? (
          <div className="text-[11px] text-slate-600">
            Could not load strategy data.
          </div>
        ) : !insights || insights.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">
              No patterns detected yet
            </div>
            <div className="mt-1 text-[10px] text-slate-700">
              Cross-competitor analysis runs automatically from signals.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => {
              const config = getPatternConfig(insight.pattern_type);
              const confColor = confidenceColor(insight.confidence);
              return (
                <div
                  key={insight.id}
                  className="rounded-[12px] border px-4 py-3.5"
                  style={{
                    borderColor: `${config.color}28`,
                    background: `${config.color}06`,
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {insight.is_major && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                          style={{
                            color: "#ef4444",
                            background: "rgba(239,68,68,0.12)",
                          }}
                        >
                          Major
                        </span>
                      )}
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: config.color }}
                      >
                        {config.label}
                      </span>
                    </div>
                    <span
                      className="text-[10px] tabular-nums"
                      style={{ color: confColor }}
                    >
                      {Math.round(insight.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mb-1 text-[11px] font-semibold text-slate-300">
                    {insight.strategic_signal}
                  </p>
                  <p className="text-[11px] leading-snug text-slate-500">
                    {insight.description}
                  </p>
                  {insight.competitors_involved.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {insight.competitors_involved.slice(0, 4).map((name) => (
                        <span
                          key={name}
                          className="rounded-full px-1.5 py-0.5 text-[9px]"
                          style={{
                            background: `${config.color}15`,
                            color: config.color,
                          }}
                        >
                          {name}
                        </span>
                      ))}
                      {insight.competitors_involved.length > 4 && (
                        <span className="text-[9px] text-slate-600">
                          +{insight.competitors_involved.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AppOverlays({
  competitors,
}: {
  competitors: RadarCompetitor[];
}) {
  const [active, setActive] = useState<OverlayType>(null);
  const close = useCallback(() => setActive(null), []);

  // Keyboard shortcuts: M = map, B = briefs, S = strategy, ESC = close
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "m":
          setActive((prev) => (prev === "map" ? null : "map"));
          break;
        case "b":
          setActive((prev) => (prev === "briefs" ? null : "briefs"));
          break;
        case "s":
          setActive((prev) => (prev === "strategy" ? null : "strategy"));
          break;
        case "escape":
          setActive((prev) => (prev !== null ? null : prev));
          break;
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // CustomEvent bridge: SidebarNav link clicks dispatch "mv:overlay"
  useEffect(() => {
    function handler(e: Event) {
      const type = (e as CustomEvent<string>).detail as OverlayType;
      setActive((prev) => (prev === type ? null : type));
    }
    window.addEventListener("mv:overlay", handler);
    return () => window.removeEventListener("mv:overlay", handler);
  }, []);

  return (
    <AnimatePresence>
      {active === "map" && (
        <MapOverlay key="map" competitors={competitors} onClose={close} />
      )}
      {active === "briefs" && (
        <BriefsOverlay key="briefs" onClose={close} />
      )}
      {active === "strategy" && (
        <StrategyOverlay key="strategy" onClose={close} />
      )}
    </AnimatePresence>
  );
}
