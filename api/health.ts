import { supabase } from "../lib/db/supabase";

const STUCK_SIGNAL_MINUTES = 30;
const RECENT_SIGNAL_DAYS = 7;
const FETCH_STALE_HOURS = 12;export default async function handler(req: any, res: any) {
  try {
    const stuckBefore = new Date(
      Date.now() - STUCK_SIGNAL_MINUTES * 60 * 1000
    ).toISOString();

    const recentSince = new Date(
      Date.now() - RECENT_SIGNAL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      latestFetchResult,
      snapshotBacklogResult,
      diffBacklogResult,
      signalBacklogResult,
      stuckSignalsResult,
      recentSignalsResult,
    ] = await Promise.all([
      supabase
        .from("snapshots")
        .select("fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("snapshots")
        .select("*", { count: "exact", head: true })
        .eq("sections_extracted", false),

      supabase
        .from("section_diffs")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed")
        .eq("signal_detected", false)
        .eq("is_noise", false),

      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),

      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("status", "interpreting")
        .lt("updated_at", stuckBefore),

      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .gt("detected_at", recentSince),
    ]);

    const results = [
      latestFetchResult,
      snapshotBacklogResult,
      diffBacklogResult,
      signalBacklogResult,
      stuckSignalsResult,
      recentSignalsResult,
    ];

    for (const result of results) {
      if (result.error) {
        throw result.error;
      }
    }

    const latestFetchAt = latestFetchResult.data?.fetched_at ?? null;
    const snapshotBacklog = snapshotBacklogResult.count ?? 0;
    const diffBacklog = diffBacklogResult.count ?? 0;
    const signalBacklog = signalBacklogResult.count ?? 0;
    const stuckSignals = stuckSignalsResult.count ?? 0;
    const recentSignals = recentSignalsResult.count ?? 0;

    const fetchIsFresh = latestFetchAt
      ? Date.now() - new Date(latestFetchAt).getTime() <
        FETCH_STALE_HOURS * 60 * 60 * 1000
      : false;

    const healthy = fetchIsFresh && stuckSignals === 0;

    res.status(200).json({
      ok: true,
      healthy,
      latestFetchAt,
      snapshotBacklog,
      diffBacklog,
      signalBacklog,
      stuckSignals,
      recentSignals,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      healthy: false,
      error: error?.message ?? String(error),
    });
  }
}
