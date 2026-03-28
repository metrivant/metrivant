// Client-side Sentry initialization.
// Loaded by @sentry/nextjs via withSentryConfig on the browser runtime.
// Enables automatic capture of client-side React errors, unhandled rejections,
// and browser exceptions. Complements sentry.server.config.ts (server/edge).

import * as Sentry from "@sentry/nextjs";
import { sanitizeEvent } from "./lib/sentry-sanitizer";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DNS,
  tracesSampleRate: 0,
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development",
  sendDefaultPii: false,
  beforeSend: sanitizeEvent as any,
});
