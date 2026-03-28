// Server-side Sentry initialization.
// Loaded by instrumentation.ts on NEXT_RUNTIME === "nodejs".
// Enables automatic capture of server-side rendering errors and unhandled
// exceptions before any manual captureException calls are made.

import * as Sentry from "@sentry/nextjs";
import { sanitizeEvent } from "./lib/sentry-sanitizer";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.SENTRY_DNS,
  tracesSampleRate: 0,
  environment:
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  beforeSend: sanitizeEvent,
});
