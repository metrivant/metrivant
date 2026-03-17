// Next.js instrumentation hook — called once at server startup per runtime.
// Initializes Sentry before any request is handled so that unhandled errors
// in server components, API routes, and edge middleware are automatically captured.
//
// lib/sentry.ts captureException calls remain the primary instrument for explicit
// error reporting. This file covers errors that escape those call sites.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
