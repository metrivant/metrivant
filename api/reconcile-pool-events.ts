import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { verifyCronSecret } from "../lib/withCronAuth";
import { reconcilePoolSignals } from "../lib/pool-reconciliation";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "reconcile-pool-events", status: "in_progress" });

  try {
    const { checked, boosted } = await reconcilePoolSignals();

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:       "reconcile-pool-events",
      checked,
      boosted,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "reconcile-pool-events", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({ ok: true, checked, boosted, runtimeDurationMs });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "reconcile-pool-events", status: "error", checkInId });
    await Sentry.flush(2000);
    res.status(500).json({ ok: false, error: String(error) });
  }
}

export default withSentry("reconcile-pool-events", handler);
