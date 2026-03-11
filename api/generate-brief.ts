import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { verifyCronSecret } from "../lib/withCronAuth";

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();

  Sentry.captureCheckIn({
    monitorSlug: "generate-brief",
    status: "in_progress",
  });

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
      implemented: false,
    });

    Sentry.captureCheckIn({
      monitorSlug: "generate-brief",
      status: "ok",
    });

    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "generate-brief",
      implemented: false,
      rowsClaimed,
      rowsProcessed,
      rowsSucceeded,
      rowsFailed,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);

    Sentry.captureCheckIn({
      monitorSlug: "generate-brief",
      status: "error",
    });

    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("generate-brief", handler);