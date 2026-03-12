# Metrivant — Product Decisions

## Core Product Decisions

### 1. Radar-First, Not Feed-First

**Decision**: The primary surface is an animated radar visualization, not a list/feed.

**Rationale**: Competitive intelligence is spatial and temporal. A radar communicates "who is moving, how fast, in what direction" at a glance. A feed shows events in isolation without conveying momentum or relative threat level. The radar keeps the user's attention on the system state, not a notification queue.

**Consequence**: Do not add a "latest activity feed" as the primary surface. The radar IS the feed.

---

### 2. Deterministic Detection, AI for Interpretation Only

**Decision**: All signal detection is deterministic (DOM diff → section diff → signal). OpenAI is only used to annotate already-detected signals with strategic context.

**Rationale**: AI-generated detections are probabilistic and unverifiable. Deterministic detection means every signal can be traced back to a specific HTML change on a specific page at a specific time. This is the credibility of the product — users must be able to see the evidence.

**Consequence**: Never add "AI-detected" signals that don't have an underlying DOM diff. The evidence chain is mandatory.

---

### 3. Supabase as the State Machine

**Decision**: All pipeline state is stored in Supabase rows. No in-memory state, no Redis, no message queues.

**Rationale**: Solo-operator maintainable. State stored in Supabase is observable, queryable, recoverable, auditable. A message queue is a black box. Supabase is transparent.

**Consequence**: Pipeline advances through row state transitions. Each stage reads qualifying rows, processes them, updates state. This pattern scales to millions of monitored pages before the architecture needs to change.

---

### 4. Two Separate Vercel Projects

**Decision**: Frontend (radar-ui) and backend (metrivant-runtime) are separate Vercel projects, not a monorepo deployment.

**Rationale**: Different deployment concerns. Frontend deploys frequently (UI changes). Backend deploys carefully (pipeline changes are higher risk). Separation allows independent deployments, separate environment variables, separate error tracking, and different Vercel plan configurations.

**Consequence**: Frontend calls backend via `RADAR_API_BASE_URL`. Secret shared between them via `CRON_SECRET`.

---

### 5. No SDK for Email

**Decision**: Resend integration uses raw `fetch()` to the REST API. No `resend` npm package.

**Rationale**: Minimal dependencies. The Resend API has a simple `POST /emails` shape. Adding an SDK adds a dependency, introduces potential version conflicts, and adds indirection for one function call. The raw fetch is more readable and just as safe.

---

### 6. Canonical PostHog Wrapper

**Decision**: All client-side PostHog calls go through `lib/posthog.ts`. Components never import `posthog-js` directly.

**Rationale**: SSR safety. `posthog-js` assumes a browser environment. The wrapper's `isActive()` check prevents crashes during server rendering. It also creates a single place to change PostHog behavior globally (e.g., add debug logging, change sampling).

---

### 7. Tracker Component Pattern

**Decision**: Use thin `"use client"` wrapper components (RadarViewedTracker, BriefViewedTracker, StrategyTracker) to fire PostHog events from server-rendered pages.

**Rationale**: The radar page, briefs page, and strategy page are server components for performance (SSR data fetch). Converting them entirely to client components to fire a single analytics event would be wasteful. The wrapper component fires on mount from the browser while the page shell remains a server component.

---

### 8. Left JOIN in radar_feed View

**Decision**: The `radar_feed` Supabase view uses LEFT JOINs so competitors with zero signals still appear.

**Rationale**: A newly added competitor (before any pipeline run) should be visible on the radar with `signals_7d = 0`, `momentum_score = 0`. Disappearing competitors from the radar until the pipeline produces a signal would make the UI seem broken.

---

### 9. First-Signal Email Detection Without Schema Changes

**Decision**: Detect "first signal" by comparing `totalAlerts` (COUNT from `alerts` table) to `newAlerts.length` (just inserted). If equal, these are the only alerts the org has ever received.

**Rationale**: Avoids adding a `has_received_first_signal` flag to the `organizations` table. The detection is derived from existing data. Simple, no migration needed.

---

### 10. CRON_SECRET Shared Between Projects

**Decision**: A single `CRON_SECRET` value is used in both Vercel projects and must match.

**Rationale**: The frontend's `check-signals` calls the backend's `radar-feed` and `competitor-detail` endpoints. The backend's pipeline endpoints also require the same secret. Using one shared secret simplifies operational setup.

---

## UI Decisions

### Color Identity
- Background: `#000200` (near-black with green cast — "night vision")
- Accent: `#2EE6A6` (phosphor green — military radar)
- Selected state: unmistakable brightness difference
- Non-selected: visually quieter (opacity-reduced)

### Motion Principles
- Sweep: 12 seconds per revolution (slow, heavy — not a spinner)
- Glow pulse: subtle, 2-4s period — conveys liveness without distraction
- Drawer transitions: smooth 300ms — not instant, not animated for the sake of it
- No bounce physics, no spring animations, no skeuomorphic effects

### Typography
- Font: Inter (system-adjacent, professional, legible at small sizes)
- Letter spacing on status labels: uppercase, wide tracking (10px, 0.22em)

### Hierarchy
1. Radar (primary: "who is moving?")
2. Drawer (secondary: "what happened?")
3. Evidence chain (tertiary: "prove it")

---

## Decisions Not Made (Deliberate Deferrals)

- **Multi-user orgs**: currently 1 org per user (one-to-one). Multi-user support deferred.
- **Custom alert rules**: all alerts use a single threshold (urgency >= 3). Custom rules deferred.
- **Webhook delivery**: no outbound webhooks. Only email. Deferred.
- **API access for customers**: no external API. Deferred.
- **Mobile app**: no mobile app. Radar optimized for desktop. Deferred.
- **Competitor auto-discovery**: Discovery page exists but is experimental (lemonade). Not promoted in main nav.
- **Plan enforcement/billing**: billing page exists but plan enforcement not yet implemented at the data layer.
