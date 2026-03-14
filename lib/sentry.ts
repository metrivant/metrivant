import * as Sentry from "@sentry/node";

// Accept both SENTRY_DSN (standard) and SENTRY_DNS (legacy typo in this project's env)
const dsn = process.env.SENTRY_DSN ?? process.env.SENTRY_DNS;

if (dsn && !Sentry.getClient()) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,
    environment:
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
  });
}

export { Sentry };
