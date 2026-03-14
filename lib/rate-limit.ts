// ── In-process token bucket rate limiter ──────────────────────────────────────
//
// Implemented as a simple sliding-window counter per key using a TTL Map.
// Designed for Vercel serverless functions — provides burst protection within
// a single warm function instance. Does NOT persist across cold starts or
// across concurrent instances (no Redis / no external state).
//
// This is intentionally lightweight. It catches high-frequency abuse within
// a single invocation window. For global rate limiting, Vercel's edge firewall
// or Upstash KV should be used instead.

type Bucket = {
  count:     number;
  windowEnd: number; // epoch ms when this window expires
};

const store = new Map<string, Bucket>();

const WINDOW_MS = 60_000; // 1-minute sliding window

// Purge expired buckets to prevent unbounded memory growth in long-lived instances
function sweep(): void {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.windowEnd < now) store.delete(key);
  }
}

// Call sweep lazily — one in every 200 checks
let sweepCounter = 0;
function maybeSweep(): void {
  if (++sweepCounter % 200 === 0) sweep();
}

/**
 * Check whether a key has exceeded its limit.
 *
 * @param key    Unique identifier — use IP address or authenticated user ID
 * @param limit  Maximum requests allowed per 60-second window
 * @returns      true if the request is allowed, false if rate-limited
 */
export function checkRateLimit(key: string, limit: number): boolean {
  maybeSweep();

  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.windowEnd < now) {
    // New window
    store.set(key, { count: 1, windowEnd: now + WINDOW_MS });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count++;
  return true;
}

/**
 * Extract client IP from request headers.
 * Handles Vercel's x-forwarded-for header.
 */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff)) return xff[0]?.split(",")[0]?.trim() ?? "unknown";
  if (typeof xff === "string") return xff.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

// Per-route limits
export const RATE_LIMITS = {
  PER_IP:  60,  // 60 req/min per IP
  PER_USER: 120, // 120 req/min per authenticated user
} as const;
