import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import {
  getPatternConfig,
  confidenceLabel,
  confidenceColor,
  getHorizon,
  HORIZON_STYLES,
  type PatternType,
  type HorizonTier,
} from "../../../lib/strategy";
import StrategyTracker from "./StrategyTracker";
import StrategyActionButton from "./StrategyActionButton";
import StrategyTimeline from "./StrategyTimeline";
import StrategyCompetitorPills from "./StrategyCompetitorPills";

// ── Types ─────────────────────────────────────────────────────────────────────

type MovementRow = {
  id:                  string;
  competitor_id:       string;
  competitor_name:     string;
  movement_type:       string;
  confidence:          number;
  signal_count:        number;
  velocity:            number | null;
  first_seen_at:       string;
  last_seen_at:        string;
  movement_summary:    string | null;
  strategic_implication: string | null;
};

type MovementGroup = {
  movement_type: string;
  movements: MovementRow[];
  avgConfidence: number;
  totalSignals: number;
  latestAt: string;
};

type InsightRow = {
  id:                   string;
  pattern_type:         PatternType;
  strategic_signal:     string;
  description:          string;
  recommended_response: string;
  confidence:           number;
  competitor_count:     number;
  competitors_involved: string[];
  is_major:             boolean;
  created_at:           string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAnalysisDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day:   "numeric",
    year:  "numeric",
  });
}

// Group insights by section: major signals → patterns → responses
// Sections are just display groupings — the data is the same set.

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ alert?: string; cid?: string; cname?: string; move?: string; conf?: string }>;
}) {
  const sp = await searchParams;
  const isAlertReferral   = sp.alert === "1";
  const alertCompetitorName = sp.cname ?? null;
  const alertMovementType   = sp.move  ?? null;
  const alertConfidence     = sp.conf  ? parseFloat(sp.conf) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ── Fetch org + competitor IDs ──────────────────────────────────────────────
  let orgId: string | null = null;
  let trackedIds: string[] = [];
  try {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    orgId = orgRow?.id ?? null;

    if (orgId) {
      const { data: tracked } = await supabase
        .from("tracked_competitors")
        .select("competitor_id")
        .eq("org_id", orgId);
      trackedIds = (tracked ?? []).map((r: { competitor_id: string }) => r.competitor_id).filter(Boolean);
    }
  } catch { /* non-fatal */ }

  // ── Fetch live movements for this org's competitors ─────────────────────────
  let movementGroups: MovementGroup[] = [];
  try {
    if (trackedIds.length > 0) {
      const { data: mvRows } = await supabase
        .from("strategic_movements")
        .select("id, competitor_id, movement_type, confidence, signal_count, velocity, first_seen_at, last_seen_at, movement_summary, strategic_implication")
        .in("competitor_id", trackedIds)
        .not("movement_type", "is", null)
        .gte("last_seen_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order("last_seen_at", { ascending: false })
        .limit(60);

      if (mvRows && mvRows.length > 0) {
        // Fetch competitor names
        const { data: compRows } = await supabase
          .from("competitors")
          .select("id, name")
          .in("id", [...new Set(mvRows.map((r: { competitor_id: string }) => r.competitor_id))]);
        const nameMap = Object.fromEntries(
          (compRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name])
        );
        const enriched: MovementRow[] = (mvRows as Array<{
          id: string; competitor_id: string; movement_type: string;
          confidence: number; signal_count: number; velocity: number | null;
          first_seen_at: string; last_seen_at: string;
          movement_summary: string | null; strategic_implication: string | null;
        }>).map((r) => ({ ...r, competitor_name: nameMap[r.competitor_id] ?? "Unknown" }));

        // Group by movement_type
        const byType = new Map<string, MovementRow[]>();
        for (const m of enriched) {
          const arr = byType.get(m.movement_type) ?? [];
          arr.push(m);
          byType.set(m.movement_type, arr);
        }
        movementGroups = [...byType.entries()]
          .map(([type, mvs]) => ({
            movement_type: type,
            movements: mvs.sort((a, b) => b.confidence - a.confidence),
            avgConfidence: mvs.reduce((s, m) => s + m.confidence, 0) / mvs.length,
            totalSignals: mvs.reduce((s, m) => s + (m.signal_count ?? 0), 0),
            latestAt: mvs.reduce((a, m) => (m.last_seen_at > a ? m.last_seen_at : a), mvs[0].last_seen_at),
          }))
          .sort((a, b) => {
            // Convergence (2+ competitors) first, then by recency
            const aConv = a.movements.length >= 2 ? 1 : 0;
            const bConv = b.movements.length >= 2 ? 1 : 0;
            if (aConv !== bConv) return bConv - aConv;
            return b.latestAt.localeCompare(a.latestAt);
          });
      }
    }
  } catch { /* non-fatal */ }

  // ── Fetch AI strategic insights ─────────────────────────────────────────────
  let insights: InsightRow[] = [];
  let fetchError  = false;
  let analysisAge = "";

  try {
    const { data, error } = await supabase
      .from("strategic_insights")
      .select(
        "id, pattern_type, strategic_signal, description, " +
        "recommended_response, confidence, competitor_count, " +
        "competitors_involved, is_major, created_at"
      )
      .order("created_at",  { ascending: false })
      .order("is_major",    { ascending: false })
      .order("confidence",  { ascending: false })
      .limit(20);

    if (error) {
      fetchError = true;
    } else {
      insights = (data ?? []) as unknown as InsightRow[];
      if (insights.length > 0) {
        analysisAge = formatAnalysisDate(insights[0].created_at);
      }
    }
  } catch {
    fetchError = true;
  }

  // Section groupings (display-only — same underlying data)
  const majorSignals       = insights.filter((i) => i.is_major);
  const otherPatterns      = insights.filter((i) => !i.is_major);
  const allPatterns        = insights;
  const hasInsights        = insights.length > 0;
  const convergenceGroups  = movementGroups.filter((g) => g.movements.length >= 2);
  const singleGroups       = movementGroups.filter((g) => g.movements.length === 1);
  const hasMovements       = movementGroups.length > 0;

  return (
    <div className="min-h-screen bg-[#000200] text-white">
      <StrategyTracker />

      {/* ── Atmospheric depth ───────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
          backgroundSize: "6px 6px",
          opacity: 0.018,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 35% at 50% -5%, rgba(46,230,166,0.05) 0%, transparent 70%)",
        }}
      />

      {/* ── Mini header ─────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#0e2210] bg-[rgba(0,2,0,0.97)] px-6">
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(46,230,166,0.20) 40%, rgba(46,230,166,0.35) 50%, rgba(46,230,166,0.20) 60%, transparent 100%)",
          }}
        />
        <Link href="/app" className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#2EE6A6" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#2EE6A6" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#2EE6A6" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#2EE6A6" />
          </svg>
          <span className="text-[13px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
        </Link>

        <div className="flex items-center gap-5">
          <Link href="/app/briefs"   className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">Briefs</Link>
          <Link href="/app/alerts"   className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">Alerts</Link>
          <Link href="/app/settings" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">Settings</Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 text-[12px] text-slate-500 transition-colors hover:text-slate-300"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Radar
          </Link>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-10">

        {/* ── Alert context banner ──────────────────────────────────── */}
        {isAlertReferral && alertCompetitorName && (
          <AlertContextBanner
            competitorName={alertCompetitorName}
            movementType={alertMovementType}
            confidence={alertConfidence}
          />
        )}

        {/* ── Title row ─────────────────────────────────────────────── */}
        <div className="mb-10 flex items-start justify-between gap-6">
          <div>
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
              Strategy
            </div>
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white">
              Market Intelligence
            </h1>
            <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-slate-500">
              Cross-competitor patterns detected from your signal feed.
              Every insight is grounded in real competitor movement — not speculation.
            </p>
          </div>
          <div className="shrink-0 pt-1 text-right">
            {analysisAge && (
              <div className="text-[11px] text-slate-600">Updated {analysisAge}</div>
            )}
            <div className="mt-1 text-[11px] text-slate-700">Analysis runs daily at 08:00 UTC</div>
          </div>
        </div>

        {/* ── No data at all ────────────────────────────────────────── */}
        {!hasMovements && !hasInsights && (
          <div
            className="flex flex-col items-center rounded-[18px] border border-[#0d2010] px-8 py-20 text-center"
            style={{ background: "rgba(2,8,2,0.5)" }}
          >
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#0d2010]"
              style={{ background: "rgba(46,230,166,0.04)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9"   stroke="rgba(46,230,166,0.28)" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="4.5" stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" />
                <line x1="12" y1="3"  x2="12" y2="6"  stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="12" y1="18" x2="12" y2="21" stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3"  y1="12" x2="6"  y2="12" stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="18" y1="12" x2="21" y2="12" stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold text-white">Pipeline building data</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-500">
              Strategic patterns derive from accumulated signal data. Add competitors and allow
              the monitoring pipeline to run — movement patterns typically emerge within 24–48 hours.
            </p>
          </div>
        )}

        {(hasMovements || hasInsights) && (
          <div className="flex flex-col gap-12">

            {/* ══════════════════════════════════════════════════════════
                SECTION 01 — Field Movements
                Live movement registry — always populated once pipeline runs
            ═══════════════════════════════════════════════════════════ */}
            {hasMovements && (
            <section>
              <SectionHeader
                index="01"
                title="Field Movements"
                subtitle={`${movementGroups.length} movement vector${movementGroups.length !== 1 ? "s" : ""} detected across ${trackedIds.length} tracked competitors · 14-day window`}
              />

              {/* Convergence — 2+ competitors sharing a movement type */}
              {convergenceGroups.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
                    Convergence Detected
                  </div>
                  <div className="flex flex-col gap-3">
                    {convergenceGroups.map((g) => (
                      <ConvergenceCard key={g.movement_type} group={g} />
                    ))}
                  </div>
                </div>
              )}

              {/* Individual movements — single competitor */}
              {singleGroups.length > 0 && (
                <div>
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
                    Individual Vectors
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {singleGroups.map((g) => (
                      <IndividualMovementCard key={g.movement_type + g.movements[0].competitor_id} group={g} />
                    ))}
                  </div>
                </div>
              )}
            </section>
            )}

            {/* ══════════════════════════════════════════════════════════
                SECTION 02 — Strategic Signals (AI)
                GPT-4o cross-competitor pattern analysis — runs daily
            ═══════════════════════════════════════════════════════════ */}
            {hasInsights && (
            <section>
              <SectionHeader
                index={hasMovements ? "02" : "01"}
                title="Strategic Signals"
                subtitle={
                  majorSignals.length > 0
                    ? `${majorSignals.length} high-priority pattern${majorSignals.length !== 1 ? "s" : ""} detected · AI analysis`
                    : "No major patterns this cycle"
                }
              />

              {majorSignals.length === 0 ? (
                <div className="rounded-[14px] border border-[#0d2010] bg-[#020802] px-5 py-4">
                  <p className="text-[13px] text-slate-600">
                    No major patterns this cycle. Patterns become major when 3+ competitors are
                    involved or confidence exceeds 82%.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {majorSignals.map((insight) => (
                    <MajorSignalCard key={insight.id} insight={insight} />
                  ))}
                </div>
              )}
            </section>
            )}

            {/* ══════════════════════════════════════════════════════════
                SECTION 03 — Market Patterns (AI)
            ═══════════════════════════════════════════════════════════ */}
            {hasInsights && otherPatterns.length > 0 && (
            <section>
              <SectionHeader
                index={hasMovements ? "03" : "02"}
                title="Market Patterns"
                subtitle={`${otherPatterns.length} supporting pattern${otherPatterns.length !== 1 ? "s" : ""} detected`}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {otherPatterns.map((insight) => (
                  <PatternCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>
            )}

            {/* ══════════════════════════════════════════════════════════
                SECTION — Recommended Responses
                Ordered by confidence — what to do first
            ═══════════════════════════════════════════════════════════ */}
            {hasInsights && (
            <section>
              <SectionHeader
                index={hasMovements ? "04" : "03"}
                title="Response Advisories"
                subtitle="Ordered by confidence · click to copy"
              />

              <div className="flex flex-col gap-2">
                {[...allPatterns]
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((insight, i) => (
                    <ResponseCard key={insight.id} insight={insight} rank={i + 1} />
                  ))}
              </div>
            </section>
            )}

            {/* ══════════════════════════════════════════════════════════
                SECTION — Competitor Timeline
            ═══════════════════════════════════════════════════════════ */}
            {hasInsights && <StrategyTimeline insights={allPatterns} />}

          </div>
        )}
      </div>
    </div>
  );
}


function HorizonBadge({ createdAt, confidence }: { createdAt: string; confidence: number }) {
  const tier = getHorizon(createdAt, confidence);
  const s = HORIZON_STYLES[tier];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {tier}
    </span>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function movementDisplayLabel(movementType: string | null): string {
  if (!movementType) return "Strategic movement";
  switch (movementType) {
    case "pricing_strategy_shift": return "Pricing strategy shift";
    case "product_expansion":      return "Product expansion";
    case "market_reposition":      return "Market repositioning";
    case "enterprise_push":        return "Enterprise push";
    case "ecosystem_expansion":    return "Ecosystem expansion";
    default:
      return movementType
        .split("_")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
  }
}

// ── Movement type color map (mirrors radar color system) ──────────────────────
function getMovementColor(type: string): string {
  switch (type) {
    case "pricing_strategy_shift": return "#FF2AD4";
    case "product_expansion":      return "#00F5FF";
    case "market_reposition":      return "#FF7A00";
    case "enterprise_push":        return "#9B5CFF";
    case "ecosystem_expansion":    return "#4A9EFF";
    default: return "#2EE6A6";
  }
}

function formatRelativeShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "just now";
}

// ── Convergence card — 2+ competitors sharing a movement type ─────────────────
function ConvergenceCard({ group }: { group: MovementGroup }) {
  const color = getMovementColor(group.movement_type);
  const label = movementDisplayLabel(group.movement_type);
  const pct = Math.round(group.avgConfidence * 100);
  // Show a summary if any movement has one
  const summary = group.movements.find((m) => m.movement_summary)?.movement_summary;

  return (
    <div
      className="relative overflow-hidden rounded-[16px] border p-5"
      style={{
        borderColor: `${color}35`,
        background: `linear-gradient(135deg, ${color}08 0%, rgba(2,8,2,0.90) 60%)`,
      }}
    >
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-[16px]" style={{ backgroundColor: color }} />

      <div className="ml-3">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
          >
            {label}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.10em]"
            style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.20)" }}
          >
            {group.movements.length} rivals converging
          </span>
        </div>

        {/* Summary if available */}
        {summary && (
          <p className="mb-3 text-[13px] leading-relaxed text-slate-300">{summary}</p>
        )}

        {/* Competitors involved */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {group.movements.map((m) => (
            <span
              key={m.competitor_id}
              className="rounded-full border px-2.5 py-0.5 text-[11px] text-slate-300"
              style={{ borderColor: `${color}25`, background: `${color}0a` }}
            >
              {m.competitor_name}
              <span className="ml-1.5 text-[10px]" style={{ color: `${color}99` }}>
                {Math.round(m.confidence * 100)}%
              </span>
            </span>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 border-t border-[#0d1f0d] pt-3 text-[11px] text-slate-600">
          <span>Avg confidence <span style={{ color }} className="font-semibold">{pct}%</span></span>
          <span>·</span>
          <span>{group.totalSignals} signals</span>
          <span>·</span>
          <span>Last seen {formatRelativeShort(group.latestAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Individual movement card ───────────────────────────────────────────────────
function IndividualMovementCard({ group }: { group: MovementGroup }) {
  const m = group.movements[0];
  const color = getMovementColor(m.movement_type);
  const label = movementDisplayLabel(m.movement_type);
  return (
    <div
      className="flex flex-col rounded-[14px] border bg-[#020802] p-4"
      style={{ borderColor: `${color}20` }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color }}
          >
            {label}
          </span>
          <p className="mt-0.5 text-[13px] font-medium text-slate-200">{m.competitor_name}</p>
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-600">
          {Math.round(m.confidence * 100)}%
        </span>
      </div>
      {m.movement_summary && (
        <p className="mb-2 text-[12px] leading-relaxed text-slate-500">{m.movement_summary}</p>
      )}
      <div className="mt-auto flex items-center gap-3 text-[10px] text-slate-700">
        <span>{m.signal_count} signal{m.signal_count !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>{formatRelativeShort(m.last_seen_at)}</span>
      </div>
    </div>
  );
}

function AlertContextBanner({
  competitorName,
  movementType,
  confidence,
}: {
  competitorName: string;
  movementType:   string | null;
  confidence:     number | null;
}) {
  return (
    <div
      className="relative mb-8 overflow-hidden rounded-[16px] border px-5 py-4"
      style={{ borderColor: "rgba(245,158,11,0.30)", background: "rgba(245,158,11,0.04)" }}
    >
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-[16px] bg-amber-500/50" />

      <div className="ml-3">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-amber-500/70">
          ⚡ Critical Alert Context
        </div>
        <p className="text-[14px] font-semibold text-white">
          Analysis triggered by accelerated movement in{" "}
          <span className="text-amber-400">{competitorName}</span>
        </p>
        {movementType && (
          <p className="mt-1 text-[12px] text-slate-500">
            {movementDisplayLabel(movementType)}
            {confidence !== null && (
              <span className="ml-2 text-slate-600">
                · {Math.round(confidence * 100)}% confidence
              </span>
            )}
          </p>
        )}
        <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
          Review the patterns below to understand how this movement connects to the broader
          competitive landscape — and identify the highest-leverage response.
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  index,
  title,
  subtitle,
}: {
  index:    string;
  title:    string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-end gap-4">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-[11px] font-bold"
            style={{ color: "rgba(46,230,166,0.40)" }}
          >
            {index}
          </span>
          <h2 className="text-[18px] font-semibold tracking-tight text-white">{title}</h2>
        </div>
        <div
          className="mb-1 h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, rgba(46,230,166,0.18) 0%, transparent 100%)",
          }}
        />
      </div>
      <p className="mt-1 text-[12px] text-slate-600">{subtitle}</p>
    </div>
  );
}

function CompetitorPills({ names }: { names: string[] }) {
  return <StrategyCompetitorPills names={names} />;
}

function ConfidencePip({ confidence }: { confidence: number }) {
  const color = confidenceColor(confidence);
  const label = confidenceLabel(confidence);
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.10em]"
      style={{ color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}99` }}
      />
      {label} · {Math.round(confidence * 100)}%
    </span>
  );
}

// Signal integrity bar — confidence + coverage side by side
function ConfidenceBar({
  confidence,
  competitorCount,
}: {
  confidence: number;
  competitorCount: number;
}) {
  const color = confidenceColor(confidence);
  const pct = Math.round(confidence * 100);
  // Coverage: competitor_count out of typical max of 5
  const coveragePct = Math.min(100, Math.round((competitorCount / 5) * 100));

  return (
    <div className="flex flex-col gap-1.5">
      {/* Confidence */}
      <div className="flex items-center gap-2">
        <span className="w-[68px] text-[10px] text-slate-600">Confidence</span>
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#0d1f0d]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
              boxShadow: `0 0 4px ${color}55`,
            }}
          />
        </div>
        <span
          className="w-[28px] text-right font-mono text-[10px] tabular-nums"
          style={{ color }}
        >
          {pct}%
        </span>
      </div>

      {/* Coverage */}
      <div className="flex items-center gap-2">
        <span className="w-[68px] text-[10px] text-slate-600">Coverage</span>
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#0d1f0d]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${coveragePct}%`,
              backgroundColor: "rgba(46,230,166,0.55)",
            }}
          />
        </div>
        <span className="w-[28px] text-right font-mono text-[10px] tabular-nums text-slate-600">
          {competitorCount}
        </span>
      </div>
    </div>
  );
}

// Major signal — banner card with large type and strong accent
function MajorSignalCard({ insight }: { insight: InsightRow }) {
  const cfg = getPatternConfig(insight.pattern_type);
  return (
    <div
      className="relative overflow-hidden rounded-[16px] border p-6"
      style={{
        borderColor: cfg.border,
        background:  `linear-gradient(135deg, ${cfg.bg} 0%, rgba(2,8,2,0.85) 60%)`,
      }}
    >
      {/* Accent bar */}
      <div
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-[16px]"
        style={{ backgroundColor: cfg.color }}
      />

      <div className="min-w-0">
        {/* Pattern type badge + horizon + competitor count */}
        <div className="mb-3 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            {cfg.label}
          </span>
          <HorizonBadge createdAt={insight.created_at} confidence={insight.confidence} />
          {insight.competitor_count >= 3 && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-red-400">
              {insight.competitor_count} rivals
            </span>
          )}
        </div>

        {/* Signal headline */}
        <h3 className="text-[16px] font-semibold leading-snug text-white">
          {insight.strategic_signal}
        </h3>

        {/* Description */}
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          {insight.description}
        </p>

        {/* Competitors */}
        {insight.competitors_involved.length > 0 && (
          <CompetitorPills names={insight.competitors_involved} />
        )}

        {/* Signal integrity bars */}
        <div className="mt-4 border-t border-[#0d2010] pt-4">
          <ConfidenceBar
            confidence={insight.confidence}
            competitorCount={insight.competitor_count}
          />
        </div>
      </div>
    </div>
  );
}

// Pattern card — 2-column grid cell
function PatternCard({ insight }: { insight: InsightRow }) {
  const cfg = getPatternConfig(insight.pattern_type);
  return (
    <div
      className="flex flex-col rounded-[14px] border bg-[#020802] p-5"
      style={{ borderColor: insight.is_major ? cfg.border : "#0e1e0e" }}
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            {cfg.label}
          </span>
          <HorizonBadge createdAt={insight.created_at} confidence={insight.confidence} />
        </div>
        {insight.is_major && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-red-400">
            Major
          </span>
        )}
      </div>

      {/* Signal */}
      <p className="mb-1.5 text-[13px] font-medium leading-snug text-slate-200">
        {insight.strategic_signal}
      </p>

      {/* Description */}
      <p className="flex-1 text-[12px] leading-relaxed text-slate-500">
        {insight.description}
      </p>

      {/* Competitors */}
      {insight.competitors_involved.length > 0 && (
        <CompetitorPills names={insight.competitors_involved} />
      )}

      {/* Signal integrity footer */}
      <div className="mt-3 border-t border-[#0d1f0d] pt-3">
        <ConfidenceBar
          confidence={insight.confidence}
          competitorCount={insight.competitor_count}
        />
      </div>
    </div>
  );
}

// Response card — ranked list with copy button
function ResponseCard({ insight, rank }: { insight: InsightRow; rank: number }) {
  const cfg = getPatternConfig(insight.pattern_type);
  return (
    <div
      className="flex items-start gap-4 rounded-[14px] border border-[#0e1e0e] bg-[#020802] px-5 py-4 transition-colors hover:border-[#152415]"
    >
      {/* Rank number */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
        style={{
          backgroundColor: `${cfg.color}12`,
          color:            cfg.color,
          border:           `1px solid ${cfg.color}25`,
        }}
      >
        {rank}
      </div>

      <div className="min-w-0 flex-1">
        {/* Pattern label + confidence inline */}
        <div className="mb-1.5 flex items-center gap-2.5">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-[10px] text-slate-700">·</span>
          <ConfidencePip confidence={insight.confidence} />
        </div>

        {/* The recommended response — the actual actionable copy */}
        <p className="text-[14px] font-medium leading-snug text-slate-200">
          {insight.recommended_response}
        </p>

        {/* Context reference */}
        <p className="mt-1 text-[12px] text-slate-600">
          In response to: {insight.strategic_signal}
        </p>

        <StrategyActionButton
          insightId={insight.id}
          patternType={insight.pattern_type}
          response={insight.recommended_response}
        />
      </div>
    </div>
  );
}
