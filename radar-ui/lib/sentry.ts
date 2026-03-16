// Thin Sentry wrapper for server-side error capture.
// Uses SENTRY_DSN (standard) or SENTRY_DNS (legacy env name in this project).
// Initialises lazily — safe to call before Next.js instrumentation is active.
// All calls are best-effort; errors in this module never propagate.

import * as SentrySDK from "@sentry/nextjs";

let initialised = false;

function init() {
  if (initialised) return;
  const dsn =
    process.env.SENTRY_DSN ??
    process.env.SENTRY_DNS ?? // legacy key name in this project
    undefined;
  if (!dsn) return;
  SentrySDK.init({ dsn, tracesSampleRate: 0 });
  initialised = true;
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

/** Capture a cron monitor check-in. Fire-and-forget. */
export function captureCheckIn(
  options: { monitorSlug: string; status: "in_progress" | "ok" | "error" }
): void {
  try {
    init();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SentrySDK.captureCheckIn(options as any);
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
