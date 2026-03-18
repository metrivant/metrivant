// ── /api/pipeline-status — public, no auth, no sensitive data
// Returns per-stage operational status: ok | warn | stale | unknown
// Used by /pipeline public page. Cached 60s.

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";

// pipeline_events.stage keys written by the backend runtime
const STAGE_MAP: Record<string, string> = {
  capture:      "fetch-snapshots",
  parse:        "extract-sections",
  baseline:     "build-baselines",
  diff:         "detect-diffs",
  signal:       "detect-signals",
  intelligence: "interpret-signals",
};

// Minutes without a successful event before status degrades
const WARN_MINS  = 70;   // sub-hourly stages → warn at 70m
const STALE_MINS = 150;  // stale at 2.5h

export type StageStatus = "ok" | "warn" | "stale" | "unknown";

export type PipelineStatusResponse = {
  stages: { id: string; status: StageStatus }[];
  generatedAt: string;
};

export async function GET(): Promise<NextResponse<PipelineStatusResponse>> {
  const unknownResponse = (): NextResponse<PipelineStatusResponse> => {
    const stages = ["capture","parse","baseline","diff","signal","intelligence","movement","radar"]
      .map((id) => ({ id, status: "unknown" as StageStatus }));
    return NextResponse.json({ stages, generatedAt: new Date().toISOString() });
  };

  try {
    const service = createServiceClient();
    const ago3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    // Fetch most recent events per stage from last 3h
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (service as any)
      .from("pipeline_events")
      .select("stage, status, created_at")
      .gte("created_at", ago3h)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return unknownResponse();

    // Last successful event per stage
    const lastSuccessAt = new Map<string, number>();
    for (const row of (rows ?? []) as { stage: string; status: string; created_at: string }[]) {
      if (row.status === "success" && !lastSuccessAt.has(row.stage)) {
        lastSuccessAt.set(row.stage, new Date(row.created_at).getTime());
      }
    }

    function ageStatus(key: string): StageStatus {
      const ts = lastSuccessAt.get(key);
      if (!ts) return "unknown";
      const ageMins = (Date.now() - ts) / 60_000;
      if (ageMins < WARN_MINS)  return "ok";
      if (ageMins < STALE_MINS) return "warn";
      return "stale";
    }

    const stages = Object.entries(STAGE_MAP).map(([id, key]) => ({
      id,
      status: ageStatus(key),
    }));

    // movement: look for detect-movements or synthesize-movement-narratives
    const movementStatus =
      ageStatus("detect-movements") !== "unknown"
        ? ageStatus("detect-movements")
        : ageStatus("synthesize-movement-narratives");
    stages.push({ id: "movement", status: movementStatus });

    // radar: derived — ok if intelligence is ok, else mirror intelligence
    const intelStatus = stages.find((s) => s.id === "intelligence")?.status ?? "unknown";
    stages.push({ id: "radar", status: intelStatus });

    const res = NextResponse.json<PipelineStatusResponse>({
      stages,
      generatedAt: new Date().toISOString(),
    });
    res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
    return res;

  } catch {
    return unknownResponse();
  }
}
