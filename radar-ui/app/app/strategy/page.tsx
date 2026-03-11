import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import {
  getPatternConfig,
  confidenceLabel,
  confidenceColor,
  type PatternType,
} from "../../../lib/strategy";
import StrategyTracker from "./StrategyTracker";
import StrategyActionButton from "./StrategyActionButton";

// ── Types ─────────────────────────────────────────────────────────────────────

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

export default async function StrategyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
  const majorSignals  = insights.filter((i) => i.is_major);
  const allPatterns   = insights;
  const hasInsights   = insights.length > 0;

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

        {/* ── Error state ───────────────────────────────────────────── */}
        {fetchError && (
          <div className="rounded-[14px] border border-[#1a2a1a] bg-[#0a140a] p-8 text-center">
            <p className="text-[13px] text-slate-600">
              Could not load strategic insights. This feature may not be enabled for your account yet.
            </p>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {!fetchError && !hasInsights && (
          <div
            className="flex flex-col items-center rounded-[18px] border border-[#0d2010] px-8 py-20 text-center"
            style={{ background: "rgba(2,8,2,0.5)" }}
          >
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#0d2010]"
              style={{ background: "rgba(46,230,166,0.04)" }}
            >
              {/* Strategy crosshairs icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9"   stroke="rgba(46,230,166,0.28)" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="4.5" stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" />
                <line x1="12" y1="3"  x2="12" y2="6"  stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="12" y1="18" x2="12" y2="21" stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3"  y1="12" x2="6"  y2="12" stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="18" y1="12" x2="21" y2="12" stroke="rgba(46,230,166,0.40)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold text-white">No patterns detected yet</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-500">
              Strategic analysis requires at least two competitors showing movement.
              Patterns will appear here once your signal feed accumulates data — analysis runs daily.
            </p>
          </div>
        )}

        {hasInsights && (
          <div className="flex flex-col gap-12">

            {/* ══════════════════════════════════════════════════════════
                SECTION 1 — Strategic Signals
                Major cross-competitor headlines that demand attention
            ═══════════════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                index="01"
                title="Strategic Signals"
                subtitle={
                  majorSignals.length > 0
                    ? `${majorSignals.length} high-priority pattern${majorSignals.length !== 1 ? "s" : ""} detected`
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

            {/* ══════════════════════════════════════════════════════════
                SECTION 2 — Market Patterns
                All detected cross-competitor patterns with full context
            ═══════════════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                index="02"
                title="Market Patterns"
                subtitle={`${allPatterns.length} pattern${allPatterns.length !== 1 ? "s" : ""} identified`}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                {allPatterns.map((insight) => (
                  <PatternCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                SECTION 3 — Recommended Responses
                Ordered by confidence — what to do first
            ═══════════════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                index="03"
                title="Recommended Responses"
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

          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
    <div className="mb-5 flex items-end gap-4">
      <div>
        <div
          className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "rgba(46,230,166,0.35)" }}
        >
          {index}
        </div>
        <h2 className="text-[18px] font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-0.5 text-[12px] text-slate-600">{subtitle}</p>
      </div>
      <div
        className="mb-1.5 h-px flex-1"
        style={{
          background:
            "linear-gradient(90deg, rgba(46,230,166,0.12) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}

function CompetitorPills({ names }: { names: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {names.map((name) => (
        <span
          key={name}
          className="rounded-full border border-[#152415] bg-[#071507] px-2 py-0.5 text-[10px] text-slate-500"
        >
          {name}
        </span>
      ))}
    </div>
  );
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

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Pattern type badge */}
          <span
            className="mb-3 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            {cfg.label}
          </span>

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
        </div>

        {/* Confidence */}
        <div className="shrink-0 pt-0.5">
          <ConfidencePip confidence={insight.confidence} />
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

      {/* Footer */}
      <div className="mt-3 border-t border-[#0d1f0d] pt-3">
        <ConfidencePip confidence={insight.confidence} />
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
