# Metrivant — Development History

This document covers the major development phases completed on the Metrivant system.

---

## Phase 1: Core Pipeline Architecture

**What was built:**
- Backend pipeline: `fetch-snapshots` → `extract-sections` → `build-baselines` → `detect-diffs` → `detect-signals` → `interpret-signals` → `update-signal-velocity` → `detect-movements`
- Supabase schema: all pipeline tables with state columns, status enums, retry tracking, dedup constraints
- `radar_feed` Supabase VIEW providing enriched per-competitor aggregates
- Vercel cron schedule: staggered 6h pipeline execution

**Key technical decisions made:**
- Deterministic detection (no AI in detection path)
- Supabase as state machine
- `FOR UPDATE SKIP LOCKED` for atomic signal claiming
- Dead letter states (`status = 'failed'` after N retries)

---

## Phase 2: Radar UI (Initial)

**What was built:**
- Next.js App Router project (`radar-ui`)
- Radar visualization: SVG canvas, D3-positioned blips, Framer Motion sweep beam
- Two-layer sweep beam (phosphor memory effect + hot zone)
- Competitor blips sized/colored by signal data
- Auth guard layout
- Landing page

**Migrations:**
- `001_saas_foundation.sql` — organizations, tracked_competitors
- `002_competitor_catalog.sql` — (catalog utilities)
- `003_weekly_briefs.sql` — weekly_briefs table
- `004_alerts.sql` — alerts table
- `005_momentum.sql` — momentum table
- `006_strategic_insights.sql` — strategic_insights table
- `007_market_map.sql` — competitor_positioning table

---

## Phase 3: Interactive Radar + Intelligence Drawer

**What was built:**
- Clickable radar blips (`handleBlipClick` in Radar.tsx)
- Selected state (brightness hierarchy — selected bright, others dim)
- Right-side intelligence drawer
- Client-side competitor detail fetch on selection
- Evidence chain: signals list with page type, summary, implication, action
- Movement cards in drawer
- `MomentumSparkline` component
- `NotificationBell` component

---

## Phase 4: Additional Product Surfaces

**What was built:**
- `app/app/alerts/` — alert feed with mark-as-read
- `app/app/briefs/` — weekly brief viewer
- `app/app/strategy/` — cross-competitor strategic analysis
- `app/app/market-map/` — 2D competitor positioning scatter
- `app/app/discover/` — competitor discovery (experimental)
- `app/app/settings/` — account settings
- `app/app/billing/` — subscription (placeholder)

---

## Phase 5: PostHog Activation

**Session date**: ~2026-03-12

**What was completed:**

### Canonical wrapper created
- `lib/posthog.ts` — SSR-safe `capture()`, `identify()`, `reset()` wrappers

### Radar events
- `competitor_selected` — fires in `handleBlipClick` when selecting (not deselecting)
- `competitor_detail_opened` — fires in detail-loading `useEffect` when `json.ok`

### Page view trackers created
- `components/RadarViewedTracker.tsx` — `radar_viewed` on mount
- `app/app/briefs/BriefViewedTracker.tsx` — `brief_viewed` on mount
- Both mounted in their respective server-rendered page components

### Refactored to canonical `capture()`
- `app/app/strategy/StrategyTracker.tsx` — removed raw fetch, uses `capture("strategy_viewed")`
- `app/app/strategy/StrategyActionButton.tsx` — uses `capture("strategy_action_clicked", ...)`
- `app/app/market-map/MarketMap.tsx` — both `market_map_viewed` and `competitor_position_inspected`
- `app/app/lemonade/LemonadeStreet.tsx` — deleted local `phCapture()` function, uses `capture()`

### Server-side events added
- `/api/onboard-competitor` — `competitor_added` with `distinct_id: user.id`

### PostHog endpoint bugs fixed
- `discover/track`: was sending batch array to `/capture/` (single-event endpoint) → fixed to `/batch`
- `alerts/read`: `/capture/` → `/capture` (trailing slash removed)
- `generate-brief`: `/capture/` → `/capture`

---

## Phase 6: Resend Email Activation

**Session date**: ~2026-03-12

**What was completed:**

### Canonical email module created
- `lib/email.ts` — `sendEmail()`, `buildWelcomeEmailHtml()`, `buildTrackingConfirmationEmailHtml()`, `buildFirstSignalEmailHtml()`
- `emailShell()` shared HTML layout (dark header, light card, `#2EE6A6` CTA buttons)
- `FROM_HELLO`, `FROM_ALERTS`, `FROM_BRIEFS` constants
- `FROM_EMAIL` env var override for all sender addresses

### Email surfaces implemented/upgraded

1. **Welcome email** — `app/api/events/signup/route.ts`
   - Upgraded from plain text to HTML using `buildWelcomeEmailHtml`
   - Raw fetch block removed, replaced with `sendEmail()`

2. **Tracking confirmation** — `app/api/onboard-competitor/route.ts`
   - New: `buildTrackingConfirmationEmailHtml`
   - Idempotency: pre-check with `.maybeSingle()` before upsert

3. **First signal email** — `app/api/check-signals/route.ts`
   - New: `buildFirstSignalEmailHtml`
   - First-signal detection: `totalAlerts === newAlerts.length`
   - Conditional logic: first signal email vs regular alert email

4. **Weekly brief email** — `app/api/generate-brief/route.ts`
   - Migrated from inline raw fetch to `sendEmail({ from: FROM_BRIEFS })`

---

## Phase 7: Production Domain Readiness

**Session date**: ~2026-03-12

**What was audited and fixed:**

- Verified `NEXT_PUBLIC_SITE_URL=https://metrivant.com` is the correct production setting
- Verified `app/layout.tsx` `metadataBase` is `https://metrivant.com`
- Verified `manifest.ts`, `robots.ts`, `sitemap.ts` all reference correct domain
- Verified no hardcoded preview/staging URLs remain in source
- Updated `.env.example` comment clarifying `RADAR_API_BASE_URL` is a separate Vercel project
- All auth callbacks and redirects confirmed correct for production domain

---

## Phase 8: Test Dataset Seed

**Session date**: ~2026-03-12

**What was created:**
- `migrations/005_seed_defence_energy_test.sql`

**Contents:**
- Phase 1: TRUNCATE all 10 pipeline tables with CASCADE
- Phase 2-4: PL/pgSQL DO $ block seeding 10 competitors, 40 pages, 110 extraction rules
- Phase 5: Validation assertions (RAISE EXCEPTION if counts don't match expected)

**Competitors seeded:**
- Defence: Lockheed Martin, Raytheon (RTX), Northrop Grumman, BAE Systems, General Dynamics
- Energy: ExxonMobil, Chevron, BP, Shell, TotalEnergies

**Pages per competitor (4):**
- homepage, newsroom, products, careers

**Rules per competitor (11, across all pages):**
- homepage: hero (h1), headline (h2), product_mentions (main), cta_blocks (a)
- newsroom: announcements (main), headline (h2)
- products: product_mentions (main), pricing_references (main), headline (h2)
- careers: hero (h1), headline (h2)

**Status at export**: Migration file created. Not yet executed in production Supabase. Awaiting manual run.
