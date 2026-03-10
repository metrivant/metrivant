import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/db/supabase";

async function handler(req: any, res: any) {

  const startedAt = Date.now();

  try {

    await supabase.rpc("cluster_recent_signals");
    await supabase.rpc("calculate_signal_velocity");

    const runtimeDurationMs = Date.now() - startedAt;

    res.status(200).json({
      ok: true,
      job: "update-signal-velocity",
      runtimeDurationMs
    });

  } catch (error) {

    Sentry.captureException(error);
    await Sentry.flush(2000);

    throw error;
  }
}

export default withSentry("update-signal-velocity", handler);