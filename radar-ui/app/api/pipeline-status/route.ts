// ── /api/pipeline-status — public, no auth, no sensitive data
// Returns per-stage operational status with timing details + pool statuses
// Used by PipelineDiagram and PipelineSchematic overlay. Cached 60s.

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";

// Actual pipeline_events.stage keys written by the backend runtime handlers
// (verified against live database 2026-03-18)
const CYCLE_STAGES = ["snapshot", "extract", "compare", "diff"] as const;
const EVENT_STAGES = ["signal", "interpret", "movement_synthesis"] as const;

// Cycle stages: stale if no success in CYCLE_WARN_MINS
const CYCLE_WARN_MINS  = 70;
const CYCLE_STALE_MINS = 150;

// Pool cron freshness thresholds (stale if >90m, warn if >180m)
const POOL_OK_MINS   = 90;
const POOL_WARN_MINS = 180;

export type StageStatus = "ok" | "warn" | "stale" | "unknown";

export type StageDetail = {
  id: string;
  status: StageStatus;
  lastRunAt: string | null;
  avgDurationMs: number | null;
  errorCount24h: number;
  totalRuns24h: number;
};

export type PoolDetail = {
  id: string;
  label: string;
  status: StageStatus;
  lastRunAt: string | null;
};

export type PipelineStatusResponse = {
  stages: StageDetail[];
  pools: PoolDetail[];
  generatedAt: string;
};

// Map from UI node ID → pipeline_events.stage value
const PIPELINE_NODE_MAP: Record<string, string> = {
  capture:      "snapshot",
  parse:        "extract",
  baseline:     "compare",
  diff:         "diff",
  signal:       "signal",
  intelligence: "interpret",
  movement:     "movement_synthesis",
};

const POOL_CRON_MAP: { id: string; label: string; ingest: string; promote?: string }[] = [
  { id: "newsroom",    label: "Newsroom",    ingest: "ingest-feeds",              promote: "promote-feed-signals" },
  { id: "careers",     label: "Careers",     ingest: "ingest-careers",            promote: "promote-careers-signals" },
  { id: "investor",    label: "Investor",    ingest: "ingest-investor-feeds",     promote: "promote-investor-signals" },
  { id: "product",     label: "Product",     ingest: "ingest-product-feeds",      promote: "promote-product-signals" },
  { id: "procurement", label: "Procurement", ingest: "ingest-procurement-feeds",  promote: "promote-procurement-signals" },
  { id: "regulatory",  label: "Regulatory",  ingest: "ingest-regulatory-feeds",   promote: "promote-regulatory-signals" },
  { id: "media",       label: "Media",       ingest: "ingest-media-feeds" },
];

export async function GET(): Promise<NextResponse<PipelineStatusResponse>> {
  const unknownStage = (id: string): StageDetail => ({
    id, status: "unknown", lastRunAt: null, avgDurationMs: null, errorCount24h: 0, totalRuns24h: 0,
  });

  const unknownAll = (): NextResponse<PipelineStatusResponse> => {
    const stages = Object.keys(PIPELINE_NODE_MAP).concat("radar").map(unknownStage);
    const pools = POOL_CRON_MAP.map(p => ({
      id: p.id, label: p.label, status: "unknown" as StageStatus, lastRunAt: null,
    }));
    return NextResponse.json({ stages, pools, generatedAt: new Date().toISOString() });
  };

  try {
    const service = createServiceClient();
    const now = Date.now();
    const ago48h = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const ago24hMs = now - 24 * 60 * 60 * 1000;

    // Parallel: pipeline_events + cron_heartbeats for pool routes
    const poolRoutes = POOL_CRON_MAP.flatMap(p => [p.ingest, ...(p.promote ? [p.promote] : [])]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [eventsResult, cronResult] = await Promise.all([
      (service as any)
        .from("pipeline_events")
        .select("stage, status, created_at, duration_ms")
        .gte("created_at", ago48h)
        .order("created_at", { ascending: false })
        .limit(2000),
      (service as any)
        .from("cron_heartbeats")
        .select("route, last_run_at, status")
        .in("route", poolRoutes),
    ]);

    if (eventsResult.error) return unknownAll();

    type Row = { stage: string; status: string; created_at: string; duration_ms: number | null };
    const allRows = (eventsResult.data ?? []) as Row[];

    // Build per-stage event lists
    const byStage = new Map<string, Row[]>();
    for (const row of allRows) {
      if (!byStage.has(row.stage)) byStage.set(row.stage, []);
      byStage.get(row.stage)!.push(row);
    }

    // ── Cycle stage status: must have run recently ────────────────────
    function cycleStatus(key: string): StageStatus {
      const stageRows = byStage.get(key) ?? [];
      const lastSuccess = stageRows.find((r) => r.status === "success");
      if (!lastSuccess) return "unknown";
      const ageMins = (now - new Date(lastSuccess.created_at).getTime()) / 60_000;
      if (ageMins < CYCLE_WARN_MINS)  return "ok";
      if (ageMins < CYCLE_STALE_MINS) return "warn";
      return "stale";
    }

    // ── Event-driven stage status ─────────────────────────────────────
    function eventStatus(key: string): StageStatus {
      const stageRows = byStage.get(key) ?? [];
      if (stageRows.length === 0) return "unknown";
      const ago2h = now - 2 * 60 * 60 * 1000;
      const recentFailures = stageRows.filter(
        (r) => r.status === "failure" && new Date(r.created_at).getTime() > ago2h
      );
      const recentSuccesses = stageRows.filter(
        (r) => r.status === "success" && new Date(r.created_at).getTime() > ago2h
      );
      if (recentFailures.length > 0 && recentSuccesses.length === 0) return "warn";
      return "ok";
    }

    // ── Build extended stage details ──────────────────────────────────
    function buildDetail(id: string, stageKey: string, isCycle: boolean): StageDetail {
      const stageRows = byStage.get(stageKey) ?? [];
      const status = isCycle ? cycleStatus(stageKey) : eventStatus(stageKey);
      const lastSuccess = stageRows.find(r => r.status === "success");
      const lastRunAt = lastSuccess?.created_at ?? null;
      const withMs = stageRows.filter(r => r.duration_ms != null);
      const avgDurationMs = withMs.length > 0
        ? Math.round(withMs.reduce((s, r) => s + r.duration_ms!, 0) / withMs.length)
        : null;
      const recent = stageRows.filter(r => new Date(r.created_at).getTime() > ago24hMs);
      return {
        id, status, lastRunAt, avgDurationMs,
        errorCount24h: recent.filter(r => r.status === "failure").length,
        totalRuns24h: recent.length,
      };
    }

    const stages: StageDetail[] = [
      buildDetail("capture",      "snapshot",           true),
      buildDetail("parse",        "extract",            true),
      buildDetail("baseline",     "compare",            true),
      buildDetail("diff",         "diff",               true),
      buildDetail("signal",       "signal",             false),
      buildDetail("intelligence", "interpret",          false),
      buildDetail("movement",     "movement_synthesis", false),
    ];

    // RADAR: derived — inherits worst of signal + intelligence
    const sigStatus   = stages.find(s => s.id === "signal")?.status       ?? "unknown";
    const intelStatus = stages.find(s => s.id === "intelligence")?.status  ?? "unknown";
    const radarStatus: StageStatus =
      sigStatus === "stale"   || intelStatus === "stale"   ? "stale"   :
      sigStatus === "warn"    || intelStatus === "warn"    ? "warn"    :
      sigStatus === "ok"      || intelStatus === "ok"      ? "ok"      :
      "unknown";

    const sigDetail = stages.find(s => s.id === "signal");
    const intelDetail = stages.find(s => s.id === "intelligence");
    stages.push({
      id: "radar",
      status: radarStatus,
      lastRunAt: sigDetail?.lastRunAt ?? null,
      avgDurationMs: null,
      errorCount24h: (sigDetail?.errorCount24h ?? 0) + (intelDetail?.errorCount24h ?? 0),
      totalRuns24h: 0,
    });

    // ── Pool statuses from cron_heartbeats ─────────────────────────────
    type CronRow = { route: string; last_run_at: string; status: string };
    const cronByRoute = new Map<string, CronRow>();
    for (const row of (cronResult.data ?? []) as CronRow[]) {
      cronByRoute.set(row.route, row);
    }

    const pools: PoolDetail[] = POOL_CRON_MAP.map(pool => {
      const ingestCron = cronByRoute.get(pool.ingest);
      const promoteCron = pool.promote ? cronByRoute.get(pool.promote) : null;
      const candidates = [ingestCron?.last_run_at, promoteCron?.last_run_at].filter(Boolean) as string[];
      const lastRunAt = candidates.sort().pop() ?? null;

      let status: StageStatus = "unknown";
      if (lastRunAt) {
        const ageMins = (now - new Date(lastRunAt).getTime()) / 60_000;
        status = ageMins < POOL_OK_MINS ? "ok" : ageMins < POOL_WARN_MINS ? "warn" : "stale";
      }
      return { id: pool.id, label: pool.label, status, lastRunAt };
    });

    const res = NextResponse.json<PipelineStatusResponse>({
      stages,
      pools,
      generatedAt: new Date().toISOString(),
    });
    res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
    return res;

  } catch {
    return unknownAll();
  }
}
