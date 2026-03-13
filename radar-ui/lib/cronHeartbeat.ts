import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Best-effort: upsert a heartbeat row for the given cron route.
 * Never throws — heartbeat failures must never surface to callers.
 *
 * Called at the end of every cron route handler to provide operational
 * visibility for /api/health stale-job detection.
 */
export async function writeCronHeartbeat(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  route: string,
  status: "ok" | "error" | "skipped",
  durationMs: number,
  rowsProcessed: number,
  detail?: string
): Promise<void> {
  try {
    await supabase.from("cron_heartbeats").upsert(
      {
        route,
        last_run_at:    new Date().toISOString(),
        status,
        duration_ms:    Math.round(durationMs),
        rows_processed: rowsProcessed,
        detail:         detail ?? null,
      },
      { onConflict: "route" }
    );
  } catch {
    // Non-fatal — heartbeat failure must not propagate
  }
}
