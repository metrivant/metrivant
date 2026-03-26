import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { verifyCronSecret } from "../lib/withCronAuth";

/**
 * calibrate-weights (DEPRECATED STUB)
 *
 * This handler is NO LONGER ACTIVE. Confidence calibration is now fully autonomous
 * via per-competitor noise baselines (lib/noise-detection.ts → calibrateConfidence).
 *
 * User feedback (signal_feedback table) is no longer used for weight calibration.
 * Statistical baselines from 30-day rolling noise rates provide automatic calibration.
 *
 * This stub exists to preserve the cron schedule without breaking deployments.
 * Can be removed once vercel.json is updated to remove the cron entry.
 */

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  return res.json({
    ok: true,
    deprecated: true,
    message: "Autonomous baseline calibration active — user feedback no longer required",
    sectionsCalibrated: 0,
    samplesProcessed: 0,
  });
}

export default withSentry("calibrate-weights", handler);
