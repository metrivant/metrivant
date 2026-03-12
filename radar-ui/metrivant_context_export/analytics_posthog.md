# Metrivant — Analytics (PostHog)

## Overview

PostHog is used for user event tracking. It is **non-blocking** and **optional** — missing PostHog keys or network failures never crash product surfaces.

Two modes:
1. **Client-side**: PostHog JS SDK via canonical `lib/posthog.ts` wrapper
2. **Server-side**: Raw `fetch()` to PostHog API (no SDK — server has no `window`)

---

## Canonical Client-Side Wrapper (`lib/posthog.ts`)

All client-side event tracking routes through this module. Never call `posthog` directly in components.

```typescript
import posthog from "posthog-js";

function isActive(): boolean {
  return typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!isActive()) return;
  posthog.capture(event, properties);
}

export function identify(userId: string, properties?: Record<string, unknown>): void {
  if (!isActive()) return;
  posthog.identify(userId, properties);
}

export function reset(): void {
  if (!isActive()) return;
  posthog.reset();
}
```

**SSR safety**: `isActive()` checks for `window` — no-op during server rendering.

---

## PostHog Initialization

### Provider (`components/PostHogProvider.tsx`)

Wraps the root layout. Initializes the PostHog JS SDK once:

```typescript
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "https://app.posthog.com",
  capture_pageview: false, // manual page tracking
});
```

`capture_pageview: false` — prevents double-counting; page views are tracked manually where meaningful.

### Identity (`components/PostHogIdentify.tsx`)

Client component mounted in `app/app/layout.tsx` (auth-gated zone). Fires once per authenticated session:

```typescript
useEffect(() => {
  identify(userId, { email });
}, [userId, email]);
```

On signout (`/api/auth/signout`): calls `posthog.reset()` to discard the identified session.

---

## Event Taxonomy

### User Lifecycle
| Event | Fired by | Properties |
|-------|----------|------------|
| `signup` | `/api/events/signup` (server) | `plan`, `source: "web"` |
| `login_completed` | `app/login/page.tsx` (client) | — |

### Radar Interactions
| Event | Fired by | Properties |
|-------|----------|------------|
| `radar_viewed` | `RadarViewedTracker` | — |
| `competitor_selected` | `Radar.tsx handleBlipClick` | `competitor_id` |
| `competitor_detail_opened` | `Radar.tsx useEffect` (on detail load) | `competitor_id` |

### Competitor Management
| Event | Fired by | Properties |
|-------|----------|------------|
| `competitor_added` | `/api/onboard-competitor` (server) | `competitor_name`, `website_url` |
| `competitor_discovered` | `/api/discover/track` (server) | `domain`, `name`, `source: "discovery"` |
| `competitor_added_from_discovery` | `/api/discover/track` (server) | `domain`, `name` |

### Alerts
| Event | Fired by | Properties |
|-------|----------|------------|
| `alert_viewed` | `/api/alerts/read` (server) | `count` |

### Navigation / Page Views
| Event | Fired by | Properties |
|-------|----------|------------|
| `strategy_viewed` | `StrategyTracker` | — |
| `brief_viewed` | `BriefViewedTracker` | — |
| `market_map_viewed` | `MarketMap.tsx useEffect` | `competitor_count` |
| `competitor_position_inspected` | `MarketMap.tsx handleSelect` | `competitor_id` |

### Strategic Actions
| Event | Fired by | Properties |
|-------|----------|------------|
| `strategy_action_clicked` | `StrategyActionButton` | `insight_id`, `pattern_type` |

### Lemonade (Experimental)
| Event | Fired by | Properties |
|-------|----------|------------|
| Various `lemonade_*` events | `LemonadeStreet.tsx` | Varies |

---

## Server-Side PostHog (Raw Fetch)

Server routes that need to fire events use raw `fetch()` since they have no `window`:

```typescript
const posthogKey = process.env.POSTHOG_API_KEY;
if (posthogKey) {
  void fetch("https://app.posthog.com/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: posthogKey,
      event: "event_name",
      distinct_id: user.email ?? user.id,
      properties: { ... },
    }),
  });
}
```

**Note**: Server-side uses `POSTHOG_API_KEY` (not `NEXT_PUBLIC_POSTHOG_KEY`). Both should be set to the same PostHog project API key. The `NEXT_PUBLIC_` prefix only controls browser exposure.

### Batch events (discover/track)

When firing multiple events from a single server route, use `/batch`:

```typescript
void fetch("https://app.posthog.com/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_key: posthogKey,
    batch: [
      { event: "competitor_discovered", distinct_id: ..., properties: { ... } },
      { event: "competitor_added_from_discovery", distinct_id: ..., properties: { ... } },
    ],
  }),
});
```

**Corrected bug**: `/api/discover/track` previously sent batch arrays to the single-event `/capture` endpoint. Fixed to `/batch`.

---

## Endpoints Reference

| Use case | Endpoint | Method |
|----------|----------|--------|
| Single event (server) | `https://app.posthog.com/capture` | POST |
| Multiple events (server) | `https://app.posthog.com/batch` | POST |
| Client SDK | Initialized via `posthog.init()` — uses PostHog's own routing | — |

**No trailing slash.** `/capture/` (with trailing slash) was a known bug in early implementations — all occurrences corrected.

---

## Environment Variables

| Variable | Used by | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Client SDK (PostHogProvider), some server routes | Exposed to browser |
| `POSTHOG_API_KEY` | Server-side API routes | Server-only, not exposed |

Both should be set to your **PostHog project API key** (same value). The `NEXT_PUBLIC_` prefix is solely a Next.js build-time bundling distinction.

---

## Non-Blocking Design

All PostHog calls follow the fire-and-forget pattern:
- `void fetch(...)` — promise is intentionally discarded
- Server routes wrap in conditional on key presence
- Client `capture()` is a no-op if `window` is undefined or key is missing
- PostHog SDK failures never propagate to product error surfaces
