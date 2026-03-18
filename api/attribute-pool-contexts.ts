import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { verifyCronSecret } from "../lib/withCronAuth";
import { attributePoolEventsToContexts } from "../lib/pool-context-attribution";

// Runs at :50 each hour — after all pool promotions (:12, :13, :16, :31, :34, :46).
// Attributes high-value pool events (acquisitions, capital raises, major contracts,
// product launches, regulatory filings, press releases) directly to competitor_contexts
// without waiting for the interpret-signals batch at :28.

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const startedAt = Date.now();
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    return res.status(500).json({ ok: false, error: "OPENAI_API_KEY not configured" });
  }

  const checkInId = Sentry.captureCheckIn({
    monitorSlug: "attribute-pool-contexts",
    status:      "in_progress",
  });

  try {
    const { competitorsUpdated, eventsAttributed, errors } =
      await attributePoolEventsToContexts(openaiKey);

    const runtimeDurationMs = Date.now() - startedAt;

    Sentry.setContext("run_metrics", {
      stage_name:           "attribute-pool-contexts",
      competitors_updated:  competitorsUpdated,
      events_attributed:    eventsAttributed,
      errors,
      runtimeDurationMs,
    });

    Sentry.captureCheckIn({
      monitorSlug: "attribute-pool-contexts",
      status:      "ok",
      checkInId,
    });
    await Sentry.flush(2000);

    return res.status(200).json({
      ok:                  true,
      job:                 "attribute-pool-contexts",
      competitors_updated: competitorsUpdated,
      events_attributed:   eventsAttributed,
      errors,
      runtimeDurationMs,
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({
      monitorSlug: "attribute-pool-contexts",
      status:      "error",
      checkInId,
    });
    await Sentry.flush(2000);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

export default withSentry("attribute-pool-contexts", handler);
