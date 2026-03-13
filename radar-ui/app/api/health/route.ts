// ── /api/health ───────────────────────────────────────────────────────────────
// Public diagnostic endpoint — no auth required.
// Returns DB connectivity, cron heartbeats, and stale-job flags.
//
// A solo engineer can hit this URL to immediately diagnose system health.
// Returns HTTP 200 when all systems nominal, 503 when any cron is stale
// or DB is unreachable.

import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase/service";

// Expected minimum run frequency (minutes) per cron route.
// Stale if last_run_at is older than these thresholds.
const STALE_THRESHOLDS: Record<string, number> = {
  "/api/check-signals":      90,    // hourly — stale after 90m
  "/api/update-momentum":    390,   // every 6h — stale after 6.5h
  "/api/generate-brief":     10080, // weekly — stale after 7 days
  "/api/strategic-analysis": 1500,  // daily — stale after 25h
  "/api/update-positioning": 1500,  // daily — stale after 25h
};

type HeartbeatRow = {
  route:          string;
  last_run_at:    string;
  status:         string;
  duration_ms:    number | null;
  rows_processed: number | null;
  detail:         string | null;
};

export async function GET(): Promise<NextResponse> {
  const start     = Date.now();
  const supabase  = createServiceClient();

  // ── DB connectivity + org count ───────────────────────────────────────────
  let dbConnected = false;
  let orgCount    = 0;

  try {
    const { count, error } = await supabase
      .from("organizations")
      .select("*", { count: "exact", head: true });
    if (!error) {
      dbConnected = true;
      orgCount    = count ?? 0;
    }
  } catch {
    // dbConnected stays false
  }

  // ── Cron heartbeats ───────────────────────────────────────────────────────
  let heartbeats: HeartbeatRow[] = [];
  let heartbeatsAvailable = false;

  try {
    const { data, error } = await supabase
      .from("cron_heartbeats")
      .select("route, last_run_at, status, duration_ms, rows_processed, detail");
    if (!error) {
      heartbeats          = (data ?? []) as HeartbeatRow[];
      heartbeatsAvailable = true;
    }
  } catch {
    // Non-fatal — table may not exist yet (migration 016 pending)
  }

  const now = Date.now();

  const cronStatus = Object.entries(STALE_THRESHOLDS).map(
    ([route, thresholdMinutes]) => {
      const hb         = heartbeats.find((h) => h.route === route);
      const lastRunMs  = hb ? new Date(hb.last_run_at).getTime() : null;
      const ageMinutes = lastRunMs !== null
        ? Math.floor((now - lastRunMs) / 60_000)
        : null;

      const stale = !heartbeatsAvailable
        ? false   // table missing — don't false-alarm; migration may be pending
        : ageMinutes === null || ageMinutes > thresholdMinutes;

      return {
        route,
        last_run_at:    hb?.last_run_at    ?? null,
        status:         hb?.status         ?? "never_run",
        age_minutes:    ageMinutes,
        stale,
        duration_ms:    hb?.duration_ms    ?? null,
        rows_processed: hb?.rows_processed ?? null,
        detail:         hb?.detail         ?? null,
      };
    }
  );

  const staleCount    = cronStatus.filter((c) => c.stale).length;
  const systemHealthy = dbConnected && staleCount === 0;

  return NextResponse.json(
    {
      ok:           systemHealthy,
      timestamp:    new Date().toISOString(),
      response_ms:  Date.now() - start,
      db: {
        connected: dbConnected,
        org_count: orgCount,
      },
      crons: {
        all_healthy:   staleCount === 0,
        stale_count:   staleCount,
        routes:        cronStatus,
      },
      notes: heartbeatsAvailable
        ? undefined
        : "cron_heartbeats table not yet created — run migration 016",
    },
    {
      status:  systemHealthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, no-cache" },
    }
  );
}
