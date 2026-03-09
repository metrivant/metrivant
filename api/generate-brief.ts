import "../lib/sentry";
import { withSentry } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";

async function handler(req: any, res: any) {
  const checkInId = crypto.randomUUID();
  const startedAt = Date.now();

  Sentry.captureCheckIn(
    {
      monitorSlug: "generate-brief",
      status: "in_progress",
    },
    checkInId
  );

  try {
    const rowsClaimed = 0;
    const rowsProcessed = 0;
    const rowsSucceeded = 0;
    const rowsFailed = 0;
    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn(
      {
        monitorSlug: "generate-brief",
        status: "ok",
      },
      checkInId
    );

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "generate-brief",
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn(
      {
        monitorSlug: "generate-brief",
        status: "error",
      },
      checkInId
    );

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("generate-brief", handler);