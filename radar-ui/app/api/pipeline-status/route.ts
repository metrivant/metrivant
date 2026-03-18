// ── /api/pipeline-status — public, no auth, no sensitive data
// Returns per-stage operational status: ok | warn | stale | unknown
// Used by /pipeline public page. Cached 60s.

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";

// Actual pipeline_events.stage keys written by the backend runtime handlers
// (verified against live database 2026-03-18)
const CYCLE_STAGES = ["snapshot", "extract", "compare", "diff"] as const;
const EVENT_STAGES = ["signal", "interpret", "movement_synthesis"] as const;

// Cycle stages (run every crawl cycle regardless of content changes):
// stale if no success in CYCLE_WARN_MINS
const CYCLE_WARN_MINS  = 70;   // sub-hourly crawl stages: warn at 70m
const CYCLE_STALE_MINS = 150;  // stale at 2.5h

export type StageStatus = "ok" | "warn" | "stale" | "unknown";

export type PipelineStatusResponse = {
  stages: { id: string; status: StageStatus }[];
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

export async function GET(): Promise<NextResponse<PipelineStatusResponse>> {
  const unknownAll = (): NextResponse<PipelineStatusResponse> => {
    const stages = Object.keys(PIPELINE_NODE_MAP).concat("radar")
      .map((id) => ({ id, status: "unknown" as StageStatus }));
    return NextResponse.json({ stages, generatedAt: new Date().toISOString() });
  };

  try {
    const service = createServiceClient();

    // Fetch last 48h of events — wide enough for both cycle and event-driven stages
    const ago48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (service as any)
      .from("pipeline_events")
      .select("stage, status, created_at")
      .gte("created_at", ago48h)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) return unknownAll();

    type Row = { stage: string; status: string; created_at: string };
    const allRows = (rows ?? []) as Row[];
    const now = Date.now();

    // Build per-stage event lists
    const byStage = new Map<string, Row[]>();
    for (const row of allRows) {
      if (!byStage.has(row.stage)) byStage.set(row.stage, []);
      byStage.get(row.stage)!.push(row);
    }

    // ── Cycle stage status: must have run recently ────────────────────────
    function cycleStatus(key: string): StageStatus {
      const stageRows = byStage.get(key) ?? [];
      const lastSuccess = stageRows.find((r) => r.status === "success");
      if (!lastSuccess) return "unknown";
      const ageMins = (now - new Date(lastSuccess.created_at).getTime()) / 60_000;
      if (ageMins < CYCLE_WARN_MINS)  return "ok";
      if (ageMins < CYCLE_STALE_MINS) return "warn";
      return "stale";
    }

    // ── Event-driven stage status: only fires when there's work in queue ─
    // "unknown" only if never seen in 48h.
    // "warn" if any failure in last 2h.
    // "ok" otherwise — a quiet queue is a healthy queue.
    function eventStatus(key: string): StageStatus {
      const stageRows = byStage.get(key) ?? [];
      if (stageRows.length === 0) return "unknown"; // never run

      const ago2h = now - 2 * 60 * 60 * 1000;
      const recentFailures = stageRows.filter(
        (r) => r.status === "failure" && new Date(r.created_at).getTime() > ago2h
      );
      const recentSuccesses = stageRows.filter(
        (r) => r.status === "success" && new Date(r.created_at).getTime() > ago2h
      );

      // Active failure with no recent recovery → stale
      if (recentFailures.length > 0 && recentSuccesses.length === 0) return "warn";
      // Any events in window → ok (pipeline ran, work was processed)
      return "ok";
    }

    const stages: { id: string; status: StageStatus }[] = [
      { id: "capture",      status: cycleStatus("snapshot") },
      { id: "parse",        status: cycleStatus("extract") },
      { id: "baseline",     status: cycleStatus("compare") },
      { id: "diff",         status: cycleStatus("diff") },
      { id: "signal",       status: eventStatus("signal") },
      { id: "intelligence", status: eventStatus("interpret") },
      { id: "movement",     status: eventStatus("movement_synthesis") },
    ];

    // RADAR: derived — inherits worst of signal + intelligence
    const sigStatus   = stages.find((s) => s.id === "signal")?.status       ?? "unknown";
    const intelStatus = stages.find((s) => s.id === "intelligence")?.status  ?? "unknown";
    const radarStatus: StageStatus =
      sigStatus === "stale"   || intelStatus === "stale"   ? "stale"   :
      sigStatus === "warn"    || intelStatus === "warn"    ? "warn"    :
      sigStatus === "ok"      || intelStatus === "ok"      ? "ok"      :
      "unknown";
    stages.push({ id: "radar", status: radarStatus });

    const res = NextResponse.json<PipelineStatusResponse>({
      stages,
      generatedAt: new Date().toISOString(),
    });
    res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
    return res;

  } catch {
    return unknownAll();
  }
}
