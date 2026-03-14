import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  try {
    const limitParam = Number(req.query?.limit ?? 20);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, 100))
      : 20;

    const { data, error } = await supabase
      .from("radar_feed")
      .select([
        "competitor_id",
        "competitor_name",
        "website_url",
        "signals_7d",
        "weighted_velocity_7d",
        "last_signal_at",
        "latest_movement_type",
        "latest_movement_confidence",
        "latest_movement_signal_count",
        "latest_movement_velocity",
        "latest_movement_first_seen_at",
        "latest_movement_last_seen_at",
        "latest_movement_summary",
        "momentum_score",
      ].join(","))
      .order("momentum_score", { ascending: false })
      .order("weighted_velocity_7d", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const runtimeDurationMs = Date.now() - startedAt;

    res.status(200).json({
      ok: true,
      job: "radar-feed",
      rowsReturned: data?.length ?? 0,
      runtimeDurationMs,
      data: data ?? [],
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export default withSentry("radar-feed", handler);