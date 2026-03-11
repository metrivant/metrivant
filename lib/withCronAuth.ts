import crypto from "crypto";
import type { ApiReq, ApiRes } from "./withSentry";

const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.warn(
    "[metrivant] CRON_SECRET is not set — pipeline endpoints are unprotected. Set CRON_SECRET in production."
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Verifies the Authorization: Bearer <CRON_SECRET> header.
 *
 * Returns true if the request is authorised (or if CRON_SECRET is not set,
 * which allows local development without configuring the secret).
 *
 * Returns false and writes a 401 response if the secret is set but the
 * header is missing or incorrect.
 */
export function verifyCronSecret(req: ApiReq, res: ApiRes): boolean {
  if (!CRON_SECRET) {
    return true;
  }

  const authHeader =
    (req.headers?.authorization as string | undefined) ?? "";
  const expected = `Bearer ${CRON_SECRET}`;

  if (timingSafeEqual(authHeader, expected)) {
    return true;
  }

  res.status(401).json({ ok: false, error: "unauthorized" });
  return false;
}
