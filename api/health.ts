import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  try {
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
        .lt(
          "updated_at",
          new Date(Date.now() - 30 * 60 * 1000).toISOString()
        ),

      supabase
        .from("signals")
        .select("*", { count: "exact", head: true })
        .gt(
          "detected_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        ),
    ]);

    const latestFetchAt = latestFetchResult.data?.fetched_at ?? null;
    const snapshotBacklog = snapshotBacklogResult.count ?? 0;
    const diffBacklog = diffBacklogResult.count ?? 0;
    const signalBacklog = signalBacklogResult.count ?? 0;
    const stuckSignals = stuckSignalsResult.count ?? 0;
    const recentSignals = recentSignalsResult.count ?? 0;

    const health = {
      ok: true,
      latestFetchAt,
      snapshotBacklog,
      diffBacklog,
      signalBacklog,
      stuckSignals,
      recentSignals,
    };

    res.status(200).json(health);
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message ?? String(error),
    });
  }
}