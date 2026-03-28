// Edge runtime Sentry initialization.
// Loaded by instrumentation.ts on NEXT_RUNTIME === "edge".
// Covers middleware and edge API routes.

import * as Sentry from "@sentry/nextjs";
import { sanitizeEvent } from "./lib/sentry-sanitizer";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.SENTRY_DNS,
  tracesSampleRate: 0,
  environment:
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  beforeSend: sanitizeEvent as any,
});
