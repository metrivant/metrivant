import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { verifyCronSecret } from "../lib/withCronAuth";
import { detectPoolSequences } from "../lib/pool-sequence-detector";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  const checkInId = Sentry.captureCheckIn({ monitorSlug: "detect-pool-sequences", status: "in_progress" });

  try {
    const { checked, sequencesFound } = await detectPoolSequences();

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:       "detect-pool-sequences",
      checked,
      sequencesFound,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({ monitorSlug: "detect-pool-sequences", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({ ok: true, checked, sequencesFound, runtimeDurationMs });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "detect-pool-sequences", status: "error", checkInId });
    await Sentry.flush(2000);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : JSON.stringify(error) });
  }
}

export default withSentry("detect-pool-sequences", handler);
