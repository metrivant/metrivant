import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

async function handler(req: any, res: any) {
  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "radar-feed",
    status: "in_progress",
  });

  try {
    const limitParam = Number(req.query?.limit ?? 20);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 20;

    const { data, error } = await supabase
      .from("radar_feed")
      .select("*")
      .order("momentum_score", { ascending: false })
      .order("weighted_velocity_7d", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsReturned: data?.length ?? 0,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "radar-feed",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "radar-feed",
      rowsReturned: data?.length ?? 0,
      runtimeDurationMs,
      data: data ?? [],
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "radar-feed",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("radar-feed", handler);