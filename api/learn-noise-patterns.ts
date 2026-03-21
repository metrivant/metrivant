import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { Sentry } from "../lib/sentry";
import { verifyCronSecret } from "../lib/withCronAuth";
import { recordEvent, startTimer, generateRunId } from "../lib/pipeline-metrics";
import { learnNoisePatterns } from "../lib/noise-pattern-learner";
import { calibrateConfidence } from "../lib/confidence-calibrator";

// Weekly cron: learns noise patterns from signal_feedback verdicts.
// Runs Sunday 07:00 UTC (after feed health check at 06:00).

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  const elapsed = startTimer();
  const runId = (req.headers as Record<string, string | undefined>)?.["x-vercel-id"] ?? generateRunId();
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "learn-noise-patterns", status: "in_progress" });

  try {
    const result = await learnNoisePatterns();

    // Also run confidence calibration (same weekly cadence, same data source)
    const calibResult = await calibrateConfidence();

    void recordEvent({
      run_id: runId,
      stage: "noise_pattern_learn",
      status: "success",
      duration_ms: elapsed(),
      metadata: {
        patterns_analyzed: result.patternsAnalyzed,
        rules_created: result.rulesCreated,
        rules_updated: result.rulesUpdated,
        rules_deactivated: result.rulesDeactivated,
        calibration_sections: calibResult.sectionsCalibrated,
      },
    });

    if (result.rulesCreated > 0) {
      Sentry.captureMessage("noise_rules_created", {
        level: "info",
        extra: { count: result.rulesCreated },
      });
    }

    Sentry.captureCheckIn({ monitorSlug: "learn-noise-patterns", status: "ok", checkInId });
    await Sentry.flush(2000);

    res.status(200).json({
      ok: true,
      job: "learn-noise-patterns",
      ...result,
      calibrationSections: calibResult.sectionsCalibrated,
      runtimeDurationMs: elapsed(),
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({ monitorSlug: "learn-noise-patterns", status: "error", checkInId });
    void recordEvent({
      run_id: runId,
      stage: "noise_pattern_learn",
      status: "failure",
      duration_ms: elapsed(),
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    await Sentry.flush(2000);
    throw error;
  }
}

export default withSentry("learn-noise-patterns", handler);
