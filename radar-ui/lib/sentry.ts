// Thin Sentry wrapper for server-side error capture.
// Uses SENTRY_DSN (standard) or SENTRY_DNS (legacy env name in this project).
// Initialises lazily — safe to call before Next.js instrumentation is active.
// All calls are best-effort; errors in this module never propagate.

import * as SentrySDK from "@sentry/nextjs";

function init() {
  // Guard against double-init: instrumentation.ts may have already called Sentry.init()
  // on the server side before any manual captureException call reaches this wrapper.
  if (SentrySDK.getClient()) return;
  const dsn =
    process.env.SENTRY_DSN ??
    process.env.SENTRY_DNS ?? // legacy key name in this project
    undefined;
  if (!dsn) return;
  SentrySDK.init({ dsn, tracesSampleRate: 0 });
}

/** Capture an exception with optional context tags. Fire-and-forget. */
export function captureException(
  err: unknown,
  context?: Record<string, string | number | boolean | null>
): void {
  try {
    init();
    SentrySDK.withScope((scope) => {
      if (context) {
        scope.setExtras(context as Record<string, unknown>);
      }
      SentrySDK.captureException(err);
    });
  } catch {
    // Never let Sentry errors surface to callers.
  }
}

/**
 * Capture a non-exception message (e.g. unexpected empty state, config warning).
 * level defaults to "warning". Fire-and-forget.
 */
export function captureMessage(
  message: string,
  context?: Record<string, string | number | boolean | null>,
  level: "debug" | "info" | "warning" | "error" | "fatal" = "warning"
): void {
  try {
    init();
    SentrySDK.withScope((scope) => {
      scope.setLevel(level);
      if (context) {
        scope.setExtras(context as Record<string, unknown>);
      }
      SentrySDK.captureMessage(message);
    });
  } catch {
    // Never let Sentry errors surface to callers.
  }
}

/**
 * Flush pending Sentry events. Call in cron route finally-paths to guarantee
 * delivery before the serverless function terminates.
 * Safe on both client and server — @sentry/nextjs exposes flush on all runtimes.
 */
export async function flush(timeoutMs = 2000): Promise<void> {
  try {
    init();
    await SentrySDK.flush(timeoutMs);
  } catch {
    // Never let Sentry errors surface to callers.
  }
}
