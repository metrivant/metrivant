import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { verifyCronSecret } from "../lib/withCronAuth";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "update-signal-velocity",
    status: "in_progress",
  });

  try {
    // cluster_recent_signals and calculate_signal_velocity are optional RPCs.
    // If they do not exist in the database yet (migration not applied), log a
    // Sentry warning rather than throwing — radar-feed.ts now computes momentum
    // inline and does not depend on these RPCs. A future migration can define them
    // if needed for additional aggregation use cases.

    Sentry.addBreadcrumb({ message: "cluster_recent_signals: start", level: "info" });
    const { error: clusterError } = await supabase.rpc("cluster_recent_signals");
    if (clusterError) {
      // PGRST202 = function does not exist (not yet migrated). Non-fatal.
      const isNotFound = (clusterError as { code?: string }).code === "PGRST202" ||
                         clusterError.message?.includes("Could not find the function");
      if (isNotFound) {
        Sentry.addBreadcrumb({ message: "cluster_recent_signals: not found (skipped)", level: "warning" });
      } else {
        Sentry.addBreadcrumb({ message: "cluster_recent_signals: failed", level: "error", data: { message: clusterError.message } });
        throw clusterError;
      }
    } else {
      Sentry.addBreadcrumb({ message: "cluster_recent_signals: ok", level: "info" });
    }

    Sentry.addBreadcrumb({ message: "calculate_signal_velocity: start", level: "info" });
    const { error: velocityError } = await supabase.rpc("calculate_signal_velocity");
    if (velocityError) {
      const isNotFound = (velocityError as { code?: string }).code === "PGRST202" ||
                         velocityError.message?.includes("Could not find the function");
      if (isNotFound) {
        Sentry.addBreadcrumb({ message: "calculate_signal_velocity: not found (skipped)", level: "warning" });
      } else {
        Sentry.addBreadcrumb({ message: "calculate_signal_velocity: failed", level: "error", data: { message: velocityError.message } });
        throw velocityError;
      }
    } else {
      Sentry.addBreadcrumb({ message: "calculate_signal_velocity: ok", level: "info" });
    }

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", { runtimeDurationMs });

    Sentry.captureCheckIn({
      monitorSlug: "update-signal-velocity",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "update-signal-velocity",
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "update-signal-velocity",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("update-signal-velocity", handler);