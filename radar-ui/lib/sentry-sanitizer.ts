import type { Event, EventHint } from "@sentry/nextjs";

/**
 * Sentry Event Sanitizer
 *
 * Implements beforeSend hook to sanitize sensitive data before events
 * reach Sentry servers. Prevents API keys, tokens, and PII from leaking
 * into error logs.
 *
 * Applied in sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts
 */

// Patterns to strip from URLs and error messages
const SENSITIVE_PATTERNS = [
  /api_key=[^&\s]*/gi,
  /apikey=[^&\s]*/gi,
  /token=[^&\s]*/gi,
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /authorization:\s*[^\s,}]+/gi,
  /sk-[a-zA-Z0-9]{20,}/gi, // OpenAI API keys
  /SCRAPINGBEE[_-]?API[_-]?KEY[^\s]*/gi,
  /CRON[_-]?SECRET[^\s]*/gi,
  /OPENAI[_-]?API[_-]?KEY[^\s]*/gi,
];

const REDACTED = "[REDACTED]";

/**
 * Sanitize a string by replacing sensitive patterns with [REDACTED]
 */
function sanitizeString(input: string | undefined | null): string | undefined | null {
  if (!input) return input;

  let sanitized = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, REDACTED);
  }
  return sanitized;
}

/**
 * Recursively sanitize an object's string values
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Drop entire fields with sensitive names
      if (
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("api_key") ||
        key.toLowerCase().includes("apikey") ||
        key.toLowerCase().includes("token")
      ) {
        sanitized[key] = REDACTED;
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sentry beforeSend hook - sanitizes events before transmission
 */
export function sanitizeEvent(event: Event, hint: EventHint): Event | null {
  // Sanitize exception messages
  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.value) {
        exception.value = sanitizeString(exception.value) ?? exception.value;
      }
    }
  }

  // Sanitize breadcrumbs (may contain URLs with API keys)
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      if (breadcrumb.message) {
        breadcrumb.message = sanitizeString(breadcrumb.message) ?? breadcrumb.message;
      }
      if (breadcrumb.data) {
        breadcrumb.data = sanitizeObject(breadcrumb.data) as Record<string, unknown>;
      }
    }
  }

  // Sanitize request data
  if (event.request) {
    if (event.request.url) {
      event.request.url = sanitizeString(event.request.url) ?? event.request.url;
    }
    if (event.request.query_string) {
      event.request.query_string = sanitizeString(event.request.query_string) ?? event.request.query_string;
    }
    if (event.request.headers) {
      event.request.headers = sanitizeObject(event.request.headers) as Record<string, string>;
    }
    if (event.request.data) {
      event.request.data = sanitizeObject(event.request.data);
    }
  }

  // Sanitize extra context
  if (event.extra) {
    event.extra = sanitizeObject(event.extra) as Record<string, unknown>;
  }

  // Sanitize contexts
  if (event.contexts) {
    event.contexts = sanitizeObject(event.contexts) as Record<string, unknown>;
  }

  return event;
}
