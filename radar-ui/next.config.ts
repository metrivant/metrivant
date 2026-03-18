import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  // Prevent DNS prefetching to reduce information leakage
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Enforce HTTPS for 2 years, including subdomains, preload eligible
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control referrer information
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser feature access
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Content Security Policy — restrict resource loading to trusted origins
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://app.posthog.com https://us-assets.i.posthog.com",
      "connect-src 'self' https://*.supabase.co https://app.posthog.com https://us.i.posthog.com https://sentry.io https://o*.ingest.sentry.io",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// withSentryConfig injects sentry.client.config.ts into the browser bundle,
// enabling automatic capture of client-side React errors and unhandled exceptions.
// Source map upload is skipped when SENTRY_AUTH_TOKEN is absent (non-fatal).
export default withSentryConfig(nextConfig, {
  automaticVercelMonitors: false, // monitors are managed manually in Sentry UI
  disableLogger: true,            // strip Sentry debug logging from production bundles
  telemetry: false,               // don't send build telemetry to Sentry
});