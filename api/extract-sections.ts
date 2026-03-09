import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";

async function handler(req: any, res: any) {
  const checkInId = crypto.randomUUID();

  Sentry.captureCheckIn({
    monitorSlug: "extract-sections",
    status: "in_progress",
    checkInId,
  });

  try {
    const snapshotsSeen = 0;
    const extractedValid = 0;
    const extractedSuspect = 0;
    const extractedFailed = 0;

    Sentry.addBreadcrumb({
      category: "pipeline",
      message: "Started extract-sections run",
      level: "info",
      data: { snapshotsSeen },
    });

    Sentry.setContext("run_metrics", {
      snapshotsSeen,
      extractedValid,
      extractedSuspect,
      extractedFailed,
    });

    Sentry.captureCheckIn({
      monitorSlug: "extract-sections",
      status: "ok",
      checkInId,
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "extract-sections",
      snapshotsSeen,
      extractedValid,
      extractedSuspect,
      extractedFailed,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "extract-sections",
      status: "error",
      checkInId,
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("extract-sections", handler);
