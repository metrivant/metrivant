import "../lib/sentry";
import { withSentry, ApiReq, ApiRes } from "../lib/withSentry";
import { verifyCronSecret } from "../lib/withCronAuth";

/**
 * learn-noise-patterns (DEPRECATED STUB)
 *
 * This handler is NO LONGER ACTIVE. Noise detection is now fully autonomous
 * via 8 deterministic filters (lib/noise-detection.ts) + statistical baselines
 * (competitor_noise_baselines) + validation feedback (retrograde-signals).
 *
 * User feedback (signal_feedback table) is no longer used.
 *
 * This stub exists to preserve the cron schedule without breaking deployments.
 * Can be removed once vercel.json is updated to remove the cron entry.
 */

async function handler(req: ApiReq, res: ApiRes) {
  if (!verifyCronSecret(req, res)) return;

  return res.json({
    ok: true,
    deprecated: true,
    message: "Autonomous noise detection active — user feedback no longer required",
    patternsAnalyzed: 0,
    rulesCreated: 0,
    rulesUpdated: 0,
    rulesDeactivated: 0,
  });
}

export default withSentry("learn-noise-patterns", handler);
