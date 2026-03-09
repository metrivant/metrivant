import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn && !Sentry.getClient()) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
  });
}

export { Sentry };
