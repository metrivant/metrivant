// ── /app/ops — Pipeline Observatory
// Operator-only view of system health. Requires authenticated user.
// No nav link — accessed directly by URL.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { createServiceClient } from "../../../lib/supabase/service";
import { RepairActionRow } from "./RepairActionRow";
import PipelineTrigger from "../../../components/PipelineTrigger";

export const dynamic = "force-dynamic";

// ── Staleness thresholds (minutes) ──────────────────────────────────────────
const STALE_THRESHOLDS: Record<string, number> = {
  // radar-ui crons
  "/api/check-signals":        90,
  "/api/update-momentum":      390,
  "/api/generate-brief":       10_080,
  "/api/strategic-analysis":   1_500,
  "/api/update-positioning":   1_500,
  "/api/record-positions":     70,
  // backend runtime crons (also write to cron_heartbeats via shared Supabase)
  "fetch-snapshots":            70,
  "extract-sections":           70,
  "build-baselines":            70,
  "detect-diffs":               70,
  "detect-signals":             70,
  "detect-ambient-activity":    70,
  "update-pressure-index":      70,
  "interpret-signals":          70,
  "update-signal-velocity":     70,
  "detect-movements":           70,
  "synthesize-movement-narratives": 70,
  "generate-radar-narratives":  70,
  "generate-sector-intelligence": 10_080,
  // pool ingest handlers — hourly, stale if >90 min
  "ingest-feeds":               90,
  "ingest-careers":             90,
  "ingest-investor-feeds":      90,
  "ingest-product-feeds":       90,
  "ingest-procurement-feeds":   90,
  "ingest-regulatory-feeds":    90,
  "ingest-media-feeds":         90,
  // pool promote handlers — hourly, stale if >90 min
  "promote-feed-signals":       90,
  "promote-careers-signals":    90,
  "promote-investor-signals":   90,
  "promote-product-signals":    90,
  "promote-procurement-signals":90,
  "promote-regulatory-signals": 90,
};

const DEFAULT_THRESHOLD = 1_500; // 25 hours — daily/weekly jobs not explicitly listed

// ── Helpers ──────────────────────────────────────────────────────────────────

function ageMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function formatAge(iso: string): string {
  const m = ageMinutes(iso);
  if (m < 60)  return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m ago`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h ago`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function cronStaleStatus(route: string, lastRunAt: string): "ok" | "warn" | "stale" {
  const threshold = STALE_THRESHOLDS[route] ?? DEFAULT_THRESHOLD;
  const age = ageMinutes(lastRunAt);
  if (age < threshold)           return "ok";
  if (age < threshold * 2)       return "warn";
  return "stale";
}

// ── Types ─────────────────────────────────────────────────────────────────────

type CronRow = {
  route:          string;
  last_run_at:    string;
  status:         string;
  duration_ms:    number | null;
  rows_processed: number | null;
  detail:         string | null;
};

type PipelineEvent = {
  stage:       string;
  status:      string;
  duration_ms: number | null;
  created_at:  string;
};

type SignalRow = {
  confidence_score: number | null;
  status:           string;
  suppressed_at:    string | null;
};

type PoolEventRow = {
  source_type:           string;
  event_type:            string;
  normalization_status:  string;
  created_at:            string;
};

type ActivityEventRow = {
  event_type:  string;
  detected_at: string;
};

type ErrorEventRow = {
  stage:       string;
  status:      string;
  duration_ms: number | null;
  metadata:    Record<string, unknown> | null;
  created_at:  string;
};

type CoverageHealthRow = {
  id:           string;
  url:          string;
  page_type:    string;
  health_state: string | null;
  competitors:  { name: string } | null;
};

type RepairSuggestionRow = {
  id:                string;
  monitored_page_id: string;
  section_type:      string;
  proposed_selector: string;
  confidence:        number;
  rationale:         string | null;
  created_at:        string;
};

// ── Aggregation helpers ───────────────────────────────────────────────────────

type StageStat = {
  stage:   string;
  total:   number;
  errors:  number;
  skipped: number;
  avgMs:   number | null;
  lastAt:  string | null;
};

function aggregateStages(events: PipelineEvent[]): StageStat[] {
  const byStage = new Map<string, PipelineEvent[]>();
  for (const e of events) {
    if (!byStage.has(e.stage)) byStage.set(e.stage, []);
    byStage.get(e.stage)!.push(e);
  }
  const STAGE_ORDER = [
    "fetch-snapshots",
    "extract-sections",
    "build-baselines",
    "detect-diffs",
    "detect-signals",
    "interpret-signals",
  ];
  const ordered: StageStat[] = [];
  // Known stages first, in pipeline order
  for (const stage of STAGE_ORDER) {
    const rows = byStage.get(stage);
    if (!rows) continue;
    ordered.push(buildStat(stage, rows));
    byStage.delete(stage);
  }
  // Any remaining stages appended
  for (const [stage, rows] of byStage) {
    ordered.push(buildStat(stage, rows));
  }
  return ordered;
}

function buildStat(stage: string, rows: PipelineEvent[]): StageStat {
  const errors  = rows.filter((r) => r.status === "error").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;
  const withMs  = rows.filter((r) => r.duration_ms != null);
  const avgMs   = withMs.length > 0
    ? Math.round(withMs.reduce((s, r) => s + r.duration_ms!, 0) / withMs.length)
    : null;
  const lastAt  = rows.reduce((a, r) => r.created_at > a ? r.created_at : a, rows[0].created_at);
  return { stage, total: rows.length, errors, skipped, avgMs, lastAt };
}

type SignalQuality = {
  total:        number;
  suppressed:   number;
  pending:      number;
  pendingReview: number;
  interpreted:  number;
  avgConf:      number | null;
  confLow:      number;  // < 0.35
  confMid:      number;  // 0.35–0.64
  confHigh:     number;  // >= 0.65
};

function aggregateSignals(rows: SignalRow[]): SignalQuality {
  let suppressed = 0, pending = 0, pendingReview = 0, interpreted = 0;
  let confLow = 0, confMid = 0, confHigh = 0, confSum = 0, confCount = 0;

  for (const r of rows) {
    if (r.suppressed_at)           suppressed++;
    if (r.status === "pending")    pending++;
    if (r.status === "pending_review") pendingReview++;
    if (r.status === "interpreted") interpreted++;
    const c = r.confidence_score;
    if (c != null) {
      confSum += c; confCount++;
      if (c < 0.35)       confLow++;
      else if (c < 0.65)  confMid++;
      else                confHigh++;
    }
  }

  return {
    total:        rows.length,
    suppressed,
    pending,
    pendingReview,
    interpreted,
    avgConf:      confCount > 0 ? confSum / confCount : null,
    confLow,
    confMid,
    confHigh,
  };
}

type PoolStat = {
  label:    string;
  total:    number;
  promoted: number;
  suppressed: number;
  lastAt:   string | null;
};

const POOL_LABELS: Record<string, string> = {
  rss:                 "Newsroom (RSS)",
  atom:                "Newsroom (Atom)",
  newsroom_feed:       "Newsroom Feed",
  greenhouse_api:      "Careers (Greenhouse)",
  lever_api:           "Careers (Lever)",
  ashby_api:           "Careers (Ashby)",
  investor_feed:       "Investor",
  product_feed:        "Product",
  procurement_feed:    "Procurement",
  regulatory_feed:     "Regulatory",
};

function aggregatePools(rows: PoolEventRow[]): PoolStat[] {
  const bySource = new Map<string, PoolEventRow[]>();
  for (const r of rows) {
    if (!bySource.has(r.source_type)) bySource.set(r.source_type, []);
    bySource.get(r.source_type)!.push(r);
  }
  return [...bySource.entries()].map(([source, evts]) => ({
    label:     POOL_LABELS[source] ?? source,
    total:     evts.length,
    promoted:  evts.filter((e) => e.normalization_status === "promoted").length,
    suppressed:evts.filter((e) => e.normalization_status === "suppressed").length,
    lastAt:    evts.reduce((a, e) => e.created_at > a ? e.created_at : a, evts[0].created_at),
  })).sort((a, b) => b.total - a.total);
}

type ActivityStat = { type: string; count: number };

function aggregateActivity(rows: ActivityEventRow[]): ActivityStat[] {
  const byType = new Map<string, number>();
  for (const r of rows) {
    byType.set(r.event_type, (byType.get(r.event_type) ?? 0) + 1);
  }
  return [...byType.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

const HEALTH_STATE_COLORS: Record<string, string> = {
  blocked:    "#ef4444",
  challenge:  "#f59e0b",
  degraded:   "#f59e0b",
  unresolved: "#ef4444",
};

type HealthStatSummary = { state: string; count: number; color: string };

function aggregateCoverageHealth(rows: CoverageHealthRow[]): HealthStatSummary[] {
  const byState = new Map<string, number>();
  for (const r of rows) {
    const s = r.health_state ?? "unknown";
    byState.set(s, (byState.get(s) ?? 0) + 1);
  }
  return [...byState.entries()]
    .map(([state, count]) => ({ state, count, color: HEALTH_STATE_COLORS[state] ?? "#64748b" }))
    .sort((a, b) => b.count - a.count);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OpsPage() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const ago7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();

  // ── Data fetches (all non-fatal) ─────────────────────────────────────────────

  let cronRows:     CronRow[]           = [];
  let pipelineEvts: PipelineEvent[]     = [];
  let signalRows:   SignalRow[]          = [];
  let poolRows:     PoolEventRow[]       = [];
  let activityRows: ActivityEventRow[]  = [];
  let errorRows:    ErrorEventRow[]     = [];
  let coverageRows: CoverageHealthRow[] = [];
  let repairRows:   RepairSuggestionRow[] = [];
  let pendingCount = 0, pendingReviewCount = 0, failedCount = 0;
  let stalePageFetchCount = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("cron_heartbeats")
      .select("route, last_run_at, status, duration_ms, rows_processed, detail")
      .order("route");
    cronRows = (data ?? []) as CronRow[];
  } catch { /* non-fatal */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("pipeline_events")
      .select("stage, status, duration_ms, created_at")
      .gte("created_at", ago24h)
      .limit(2000);
    pipelineEvts = (data ?? []) as PipelineEvent[];
  } catch { /* non-fatal */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("signals")
      .select("confidence_score, status, suppressed_at")
      .gte("detected_at", ago7d)
      .limit(2000);
    signalRows = (data ?? []) as SignalRow[];
  } catch { /* non-fatal */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("pool_events")
      .select("source_type, event_type, normalization_status, created_at")
      .gte("created_at", ago24h)
      .limit(500);
    poolRows = (data ?? []) as PoolEventRow[];
  } catch { /* non-fatal */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("activity_events")
      .select("event_type, detected_at")
      .gte("detected_at", ago24h)
      .limit(500);
    activityRows = (data ?? []) as ActivityEventRow[];
  } catch { /* non-fatal */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("pipeline_events")
      .select("stage, status, duration_ms, metadata, created_at")
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(10);
    errorRows = (data ?? []) as ErrorEventRow[];
  } catch { /* non-fatal */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingData } = await (service as any)
      .from("signals")
      .select("status")
      .in("status", ["pending", "pending_review", "failed"])
      .limit(500);
    for (const r of (pendingData ?? []) as { status: string }[]) {
      if (r.status === "pending")        pendingCount++;
      if (r.status === "pending_review") pendingReviewCount++;
      if (r.status === "failed")         failedCount++;
    }
  } catch { /* non-fatal */ }

  try {
    const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (service as any)
      .from("monitored_pages")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .lt("last_fetched_at", staleCutoff);
    stalePageFetchCount = count ?? 0;
  } catch { /* non-fatal */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("monitored_pages")
      .select("id, url, page_type, health_state, competitors(name)")
      .in("health_state", ["blocked", "challenge", "degraded", "unresolved"])
      .order("health_state")
      .limit(50);
    coverageRows = (data ?? []) as CoverageHealthRow[];
  } catch { /* non-fatal */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (service as any)
      .from("selector_repair_suggestions")
      .select("id, monitored_page_id, section_type, proposed_selector, confidence, rationale, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    repairRows = (data ?? []) as RepairSuggestionRow[];
  } catch { /* non-fatal */ }

  // ── Aggregations ─────────────────────────────────────────────────────────────
  const stageStats    = aggregateStages(pipelineEvts);
  const signalQuality = aggregateSignals(signalRows);
  const poolStats     = aggregatePools(poolRows);
  const activityStats = aggregateActivity(activityRows);

  // Overall system status from crons
  const staleCrons = cronRows.filter((r) =>
    cronStaleStatus(r.route, r.last_run_at) === "stale"
  );
  const warnCrons  = cronRows.filter((r) =>
    cronStaleStatus(r.route, r.last_run_at) === "warn"
  );
  const systemOk = staleCrons.length === 0 && errorRows.filter((e) => {
    return Date.now() - new Date(e.created_at).getTime() < 3_600_000; // last 1h
  }).length === 0;

  const generatedAt = now.toISOString();

  return (
    <div className="min-h-screen bg-[#000002] text-white">
      {/* ── Atmospheric depth ─────────────────────────────────────────────── */}
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
            "radial-gradient(ellipse 60% 35% at 50% -5%, rgba(0,180,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#0e1022] bg-[rgba(0,2,0,0.97)] px-6">
        <div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,180,255,0.20) 40%, rgba(0,180,255,0.35) 50%, rgba(0,180,255,0.20) 60%, transparent 100%)",
          }}
        />
        <Link href="/app" className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <circle cx="23" cy="23" r="21.5" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.50" />
            <circle cx="23" cy="23" r="13"   stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.28" />
            <circle cx="23" cy="23" r="5.5"  stroke="#00B4FF" strokeWidth="1"   strokeOpacity="0.42" />
            <path d="M23 23 L17.8 2.6 A21.5 21.5 0 0 1 38.2 9.8 Z" fill="#00B4FF" fillOpacity="0.10" />
            <line x1="23" y1="23" x2="38.2" y2="9.8" stroke="#00B4FF" strokeWidth="1.5" strokeOpacity="0.80" />
            <circle cx="23" cy="23" r="2.5" fill="#00B4FF" />
          </svg>
          <span className="text-[13px] font-bold tracking-[0.08em] text-white">METRIVANT</span>
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/app/strategy" className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">Strategy</Link>
          <Link href="/app/briefs"   className="text-[12px] text-slate-600 transition-colors hover:text-slate-400">Briefs</Link>
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

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-10">

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <div className="mb-10 flex items-start justify-between gap-6">
          <div>
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-600">
              Operator
            </div>
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white">
              Pipeline Observatory
            </h1>
            <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-slate-500">
              Real-time view of pipeline health, signal quality, and cron execution.
              Data refreshes on each page load.
            </p>
            <div className="mt-3">
              <PipelineTrigger />
            </div>
          </div>
          <div className="shrink-0 pt-1 text-right">
            <SystemStatusBadge ok={systemOk} staleCrons={staleCrons.length} warnCrons={warnCrons.length} />
            <div className="mt-1.5 text-[11px] text-slate-700">
              Generated {formatAge(generatedAt)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-12">

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 01 — Signal Backlog
          ═══════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader
              index="01"
              title="Signal Backlog"
              subtitle="Signals queued for interpretation · all orgs"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Pending" value={pendingCount} accent="#00B4FF"
                note="awaiting gpt-4o-mini" />
              <StatCard label="Pending Review" value={pendingReviewCount} accent="#f59e0b"
                note="held — pressure_index gate" />
              <StatCard label="Failed" value={failedCount}
                accent={failedCount > 0 ? "#ef4444" : "rgba(148,163,184,0.4)"}
                note="retries exhausted" />
              <StatCard label="7d Signals" value={signalQuality.total} accent="rgba(148,163,184,0.6)"
                note="detected this week" />
              <StatCard label="7d Interpreted" value={signalQuality.interpreted} accent="#4A9EFF"
                note="completed interpretations" />
              <StatCard label="Stale Pages" value={stalePageFetchCount}
                accent={stalePageFetchCount >= 5 ? "#ef4444" : stalePageFetchCount > 0 ? "#f59e0b" : "rgba(148,163,184,0.4)"}
                note="not fetched in 24h" />
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 02 — Cron Health
          ═══════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader
              index="02"
              title="Cron Health"
              subtitle={`${cronRows.length} registered cron routes · last execution times`}
            />
            {cronRows.length === 0 ? (
              <EmptyState message="No cron heartbeats found — cron_heartbeats table may not be applied." />
            ) : (
              <div className="overflow-hidden rounded-[14px] border border-[#0e1e0e]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[#0e1e0e] bg-[#020208]">
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Route</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Last Run</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Duration</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Rows</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cronRows.map((row, i) => {
                      const stale = cronStaleStatus(row.route, row.last_run_at);
                      const rowError = row.status === "error";
                      const statusColor = rowError
                        ? "#ef4444"
                        : stale === "stale"
                          ? "#ef4444"
                          : stale === "warn"
                            ? "#f59e0b"
                            : "#00B4FF";
                      return (
                        <tr
                          key={row.route}
                          className="border-b border-[#0a0a1a] last:border-0 transition-colors hover:bg-[#040c04]"
                        >
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                            {row.route}
                            {row.detail && (
                              <span className="ml-2 truncate text-[10px] text-red-400/70" title={row.detail}>
                                · {row.detail.slice(0, 40)}{row.detail.length > 40 ? "…" : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[11px] tabular-nums text-slate-500">
                            {formatAge(row.last_run_at)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[11px] tabular-nums text-slate-600">
                            {formatDuration(row.duration_ms)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[11px] tabular-nums text-slate-600">
                            {row.rows_processed != null ? row.rows_processed : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.10em]"
                              style={{ color: statusColor }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: statusColor, boxShadow: `0 0 4px ${statusColor}99` }}
                              />
                              {rowError ? "error" : stale}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 03 — Pipeline Stages (last 24h)
          ═══════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader
              index="03"
              title="Pipeline Stages"
              subtitle={`${pipelineEvts.length} events in last 24h across ${stageStats.length} active stages`}
            />
            {stageStats.length === 0 ? (
              <EmptyState message="No pipeline events in last 24 hours — pipeline may not be running." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stageStats.map((s) => (
                  <StageCard key={s.stage} stat={s} />
                ))}
              </div>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 04 — Signal Quality (last 7d)
          ═══════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader
              index="04"
              title="Signal Quality"
              subtitle="Confidence distribution and suppression rates · 7-day window"
            />
            {signalQuality.total === 0 ? (
              <EmptyState message="No signals in the last 7 days." />
            ) : (
              <div className="rounded-[14px] border border-[#0e1e0e] bg-[#020208] p-5">
                <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <MiniStat label="Total Signals"   value={signalQuality.total} />
                  <MiniStat label="Suppressed"       value={signalQuality.suppressed}
                    note={signalQuality.total > 0
                      ? `${Math.round(signalQuality.suppressed / signalQuality.total * 100)}%`
                      : undefined}
                  />
                  <MiniStat label="Avg Confidence"
                    value={signalQuality.avgConf != null
                      ? `${Math.round(signalQuality.avgConf * 100)}%`
                      : "—"}
                  />
                  <MiniStat label="Interpreted" value={signalQuality.interpreted} />
                </div>

                <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
                  Confidence Distribution
                </div>
                <div className="mt-2 flex flex-col gap-2.5">
                  <ConfBar
                    label="High ≥ 0.65"
                    count={signalQuality.confHigh}
                    total={signalQuality.total}
                    color="#00B4FF"
                    note="sent to GPT-4o-mini"
                  />
                  <ConfBar
                    label="Mid 0.35–0.64"
                    count={signalQuality.confMid}
                    total={signalQuality.total}
                    color="#f59e0b"
                    note="held in pending_review"
                  />
                  <ConfBar
                    label="Low < 0.35"
                    count={signalQuality.confLow}
                    total={signalQuality.total}
                    color="#ef4444"
                    note="suppressed"
                  />
                </div>
              </div>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 05 — Pool Activity (last 24h)
          ═══════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader
              index="05"
              title="Pool Activity"
              subtitle={`${poolRows.length} events ingested in last 24h across ${poolStats.length} active pools`}
            />
            {poolStats.length === 0 ? (
              <EmptyState message="No pool events in last 24 hours." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {poolStats.map((p) => (
                  <PoolCard key={p.label} stat={p} />
                ))}
              </div>
            )}
            {activityStats.length > 0 && (
              <div className="mt-4 rounded-[12px] border border-[#0a0a1a] bg-[#020208] px-4 py-3">
                <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
                  Ambient Events (24h) — {activityRows.length} total
                </div>
                <div className="flex flex-wrap gap-2">
                  {activityStats.map((a) => (
                    <span
                      key={a.type}
                      className="rounded-full border border-[#0e2010] bg-[#020208] px-2.5 py-1 font-mono text-[11px] text-slate-500"
                    >
                      {a.type} <span className="text-slate-400 tabular-nums">{a.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 06 — Recent Pipeline Errors
          ═══════════════════════════════════════════════════════════════ */}
          {errorRows.length > 0 && (
            <section>
              <SectionHeader
                index="06"
                title="Recent Errors"
                subtitle={`Last ${errorRows.length} pipeline errors`}
              />
              <div className="flex flex-col gap-2">
                {errorRows.map((e, i) => (
                  <ErrorRow key={i} error={e} />
                ))}
              </div>
            </section>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 07 — Coverage Health
          ═══════════════════════════════════════════════════════════════ */}
          <section>
            <SectionHeader
              index="07"
              title="Coverage Health"
              subtitle={
                coverageRows.length === 0
                  ? "All monitored pages healthy"
                  : `${coverageRows.length} page${coverageRows.length !== 1 ? "s" : ""} degraded, blocked, or unresponsive`
              }
            />
            {coverageRows.length === 0 ? (
              <EmptyState message="All monitored pages reporting healthy status." />
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {aggregateCoverageHealth(coverageRows).map((s) => (
                    <div
                      key={s.state}
                      className="rounded-full px-3 py-1.5 font-mono text-[11px]"
                      style={{
                        color:           s.color,
                        backgroundColor: `${s.color}0e`,
                        border:          `1px solid ${s.color}30`,
                      }}
                    >
                      {s.state} <span className="opacity-60">{s.count}</span>
                    </div>
                  ))}
                </div>
                <div className="overflow-hidden rounded-[14px] border border-[#0e1e0e]">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[#0e1e0e] bg-[#020208]">
                        <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Competitor</th>
                        <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">Page</th>
                        <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">URL</th>
                        <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-slate-700">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverageRows.map((row) => {
                        const color = HEALTH_STATE_COLORS[row.health_state ?? ""] ?? "#64748b";
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-[#0a0a1a] last:border-0 transition-colors hover:bg-[#040c04]"
                          >
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                              {row.competitors?.name ?? "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                              {row.page_type}
                            </td>
                            <td className="max-w-[240px] truncate px-4 py-3 font-mono text-[11px] text-slate-700">
                              {row.url}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
                                style={{
                                  color,
                                  backgroundColor: `${color}10`,
                                  border:          `1px solid ${color}28`,
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                                {row.health_state}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 08 — Selector Repair Queue
          ═══════════════════════════════════════════════════════════════ */}
          {repairRows.length > 0 && (
            <section>
              <SectionHeader
                index="08"
                title="Selector Repair Queue"
                subtitle={`${repairRows.length} pending proposal${repairRows.length !== 1 ? "s" : ""} — AI-generated, awaiting operator review`}
              />
              <div className="flex flex-col gap-2">
                {repairRows.map((r) => (
                  <RepairActionRow
                    key={r.id}
                    id={r.id}
                    monitored_page_id={r.monitored_page_id}
                    section_type={r.section_type}
                    proposed_selector={r.proposed_selector}
                    confidence={r.confidence}
                    rationale={r.rationale}
                    created_at={r.created_at}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-end gap-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] font-bold" style={{ color: "rgba(0,180,255,0.40)" }}>
            {index}
          </span>
          <h2 className="text-[18px] font-semibold tracking-tight text-white">{title}</h2>
        </div>
        <div
          className="mb-1 h-px flex-1"
          style={{ background: "linear-gradient(90deg, rgba(0,180,255,0.18) 0%, transparent 100%)" }}
        />
      </div>
      <p className="mt-1 text-[12px] text-slate-600">{subtitle}</p>
    </div>
  );
}

function SystemStatusBadge({
  ok,
  staleCrons,
  warnCrons,
}: {
  ok: boolean;
  staleCrons: number;
  warnCrons: number;
}) {
  const color  = ok ? "#00B4FF" : staleCrons > 0 ? "#ef4444" : "#f59e0b";
  const label  = ok ? "healthy" : staleCrons > 0 ? "degraded" : "warning";
  const detail = staleCrons > 0
    ? `${staleCrons} stale cron${staleCrons !== 1 ? "s" : ""}`
    : warnCrons > 0
      ? `${warnCrons} overdue`
      : "all systems nominal";

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{
          color,
          background: `${color}12`,
          border:     `1px solid ${color}30`,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }}
        />
        {label}
      </span>
      <span className="text-[10px] text-slate-700">{detail}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  note,
}: {
  label:  string;
  value:  number;
  accent: string;
  note?:  string;
}) {
  return (
    <div className="rounded-[14px] border border-[#0e1e0e] bg-[#020208] px-4 py-4">
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
        {label}
      </div>
      <div className="font-mono text-[26px] font-bold tabular-nums leading-none" style={{ color: accent }}>
        {value}
      </div>
      {note && <div className="mt-1.5 text-[10px] text-slate-700">{note}</div>}
    </div>
  );
}

function StageCard({ stat }: { stat: StageStat }) {
  const errorRate = stat.total > 0 ? stat.errors / stat.total : 0;
  const accentColor =
    stat.errors > 0 && errorRate > 0.1 ? "#ef4444" :
    stat.errors > 0 ? "#f59e0b" :
    "#00B4FF";

  return (
    <div
      className="relative rounded-[14px] border bg-[#020208] p-4"
      style={{ borderColor: stat.errors > 0 ? "rgba(239,68,68,0.20)" : "#0e1e0e" }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="font-mono text-[11px] font-bold text-slate-300">{stat.stage}</div>
        {stat.errors > 0 && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-red-400">
            {stat.errors} err
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[28px] font-bold tabular-nums leading-none" style={{ color: accentColor }}>
          {stat.total}
        </span>
        <span className="text-[11px] text-slate-600">runs</span>
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-[#0a0a1a] pt-3 font-mono text-[10px] tabular-nums text-slate-700">
        {stat.avgMs != null && (
          <span>avg <span className="text-slate-500">{formatDuration(stat.avgMs)}</span></span>
        )}
        {stat.skipped > 0 && (
          <span><span className="text-slate-500">{stat.skipped}</span> skipped</span>
        )}
        {stat.lastAt && (
          <span className="ml-auto">{formatAge(stat.lastAt)}</span>
        )}
      </div>
    </div>
  );
}

function ConfBar({
  label,
  count,
  total,
  color,
  note,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  note:  string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-[110px] shrink-0 text-[11px] text-slate-500">{label}</div>
      <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-[#0d1f0d]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}55` }}
        />
      </div>
      <div className="w-[80px] text-right font-mono text-[11px] tabular-nums" style={{ color }}>
        {count} <span className="text-slate-700">({pct}%)</span>
      </div>
      <div className="hidden w-[140px] text-right text-[10px] text-slate-700 sm:block">{note}</div>
    </div>
  );
}

function PoolCard({ stat }: { stat: PoolStat }) {
  const promoteRate = stat.total > 0 ? Math.round((stat.promoted / stat.total) * 100) : 0;
  return (
    <div className="rounded-[14px] border border-[#0e1e0e] bg-[#020208] p-4">
      <div className="mb-2 font-mono text-[11px] font-bold text-slate-300">{stat.label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[24px] font-bold tabular-nums leading-none text-[#00B4FF]">
          {stat.total}
        </span>
        <span className="text-[11px] text-slate-600">events</span>
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-[#0a0a1a] pt-3 font-mono text-[10px] tabular-nums text-slate-700">
        <span>promoted <span className="text-slate-500">{stat.promoted}</span></span>
        <span>·</span>
        <span>suppressed <span className="text-slate-500">{stat.suppressed}</span></span>
        {stat.total > 0 && <span>· <span className="text-slate-500">{promoteRate}%</span> rate</span>}
        {stat.lastAt && <span className="ml-auto">{formatAge(stat.lastAt)}</span>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-700">{label}</div>
      <div className="font-mono text-[20px] font-bold tabular-nums leading-none text-white">{value}</div>
      {note && <div className="mt-0.5 font-mono text-[10px] text-slate-600">{note}</div>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-[#0a0a1a] bg-[#020208] px-4 py-5">
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: "rgba(100,116,139,0.5)" }}
      />
      <p className="text-[12px] text-slate-600">{message}</p>
    </div>
  );
}

function ErrorRow({ error }: { error: ErrorEventRow }) {
  const errorDetail = error.metadata?.error as string | undefined;
  return (
    <div className="relative overflow-hidden rounded-[12px] border border-red-500/15 bg-[#020208] px-4 py-3">
      <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-[12px] bg-red-500/40" />
      <div className="ml-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-red-400">{error.stage}</span>
            <span className="text-[10px] text-slate-700">·</span>
            <span className="font-mono text-[10px] text-slate-600">{formatAge(error.created_at)}</span>
          </div>
          {errorDetail && (
            <p className="mt-0.5 truncate text-[11px] text-slate-500" title={errorDetail}>
              {errorDetail.slice(0, 120)}{errorDetail.length > 120 ? "…" : ""}
            </p>
          )}
        </div>
        {error.duration_ms != null && (
          <span className="shrink-0 font-mono text-[10px] text-slate-700">
            {formatDuration(error.duration_ms)}
          </span>
        )}
      </div>
    </div>
  );
}

