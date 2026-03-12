# Metrivant — Phase Reports

This document contains all Phase 5 reports produced during the development session.

---

## PostHog Activation — Phase 5 Report

**Files changed:**
- `components/Radar.tsx` — added `competitor_selected` and `competitor_detail_opened` events via canonical `capture()`
- `components/RadarViewedTracker.tsx` — CREATED: client component, fires `radar_viewed` on mount
- `app/app/page.tsx` — added `<RadarViewedTracker />` import and render
- `app/app/strategy/StrategyTracker.tsx` — removed 8-line raw fetch boilerplate, now uses `capture("strategy_viewed")`
- `app/app/strategy/StrategyActionButton.tsx` — added `import { capture }`, replaced 12-line raw fetch with `capture("strategy_action_clicked", ...)`
- `app/app/market-map/MarketMap.tsx` — added `import { capture }`, replaced both `market_map_viewed` and `competitor_position_inspected` raw fetches
- `app/app/lemonade/LemonadeStreet.tsx` — deleted local `phCapture()` function (12 lines), all calls use `capture()`
- `app/app/briefs/BriefViewedTracker.tsx` — CREATED: same pattern as RadarViewedTracker, fires `brief_viewed`
- `app/app/briefs/page.tsx` — added `<BriefViewedTracker />` as first child
- `app/api/onboard-competitor/route.ts` — added server-side `competitor_added` PostHog event
- `app/api/discover/track/route.ts` — fixed PostHog: `/capture/` → `/batch`
- `app/api/alerts/read/route.ts` — fixed PostHog: `/capture/` → `/capture`

**Files deleted:** none

**What was simplified:**
- Removed ~40 lines of duplicate raw PostHog fetch boilerplate across 4 components
- Replaced with 1-line `capture()` calls through canonical wrapper

**Functionality improved:**
- Full coverage of key user interactions in PostHog
- SSR-safe analytics (no server-render crashes)
- Correct PostHog endpoints (batch vs capture)
- `competitor_selected` and `competitor_detail_opened` events added to radar

**Risks avoided:**
- PostHog crashes on server render (prevented by `isActive()` check)
- Batch array sent to single-event endpoint (fixed in discover/track)
- Trailing slash on PostHog endpoints causing silent failures

**Remaining technical debt:**
- No rate limiting on PostHog server-side calls
- `POSTHOG_API_KEY` and `NEXT_PUBLIC_POSTHOG_KEY` currently use the same value — documented but architecturally redundant

---

## Resend Email Activation — Phase 5 Report

**Files created:**
- `lib/email.ts` — canonical email module with `sendEmail()`, `buildWelcomeEmailHtml()`, `buildTrackingConfirmationEmailHtml()`, `buildFirstSignalEmailHtml()`

**Files changed:**
- `app/api/events/signup/route.ts` — upgraded welcome email from plain text to HTML; migrated to `sendEmail()`
- `app/api/check-signals/route.ts` — added first-signal detection; conditional first-signal vs regular alert email; migrated to `sendEmail()`
- `app/api/generate-brief/route.ts` — migrated to `sendEmail({ from: FROM_BRIEFS })`; fixed PostHog endpoint
- `app/api/onboard-competitor/route.ts` — added tracking confirmation email with idempotency check

**What was simplified:**
- Eliminated ~30 lines of inline raw fetch email boilerplate across 3 routes
- All email construction centralized in `lib/email.ts`
- Consistent visual identity across all 4 email templates

**Functionality improved:**
- Welcome email upgraded to branded HTML
- Tracking confirmation: new email flow informing user their competitor is live
- First-signal detection: personalized first-signal email for new users
- Weekly brief: sent from correct `briefs@metrivant.com` address

**Risks avoided:**
- Duplicate tracking confirmation emails (idempotency via `.maybeSingle()` pre-check)
- Email failures crashing product routes (graceful degradation in `sendEmail()`)
- No `RESEND_API_KEY` crashing on startup (late-binding check inside `sendEmail()`)

**Remaining technical debt:**
- Welcome email does not confirm Supabase account creation — it fires after form submit, before email confirmation. Acceptable for current stage.
- No unsubscribe links in transactional emails (low risk for B2B transactional)
- `FROM_EMAIL` override only supports a single address for all three prefixes — may need per-prefix overrides eventually

---

## Production Domain Readiness — Phase 5 Report

**Files changed:**
- `.env.example` — clarified `RADAR_API_BASE_URL` comment to explain it's a separate Vercel project from radar-ui

**Files audited (no changes needed):**
- `app/layout.tsx` — `metadataBase: new URL("https://metrivant.com")` ✓
- `app/manifest.ts` — references `metrivant.com` ✓
- `app/robots.ts` — references `metrivant.com` ✓
- `app/sitemap.ts` — references `metrivant.com` ✓
- `next.config.ts` — no hardcoded URLs ✓
- All API routes — auth callbacks redirect to `NEXT_PUBLIC_SITE_URL` (not hardcoded) ✓

**What was simplified:** none (audit only)

**Risks avoided:**
- No hardcoded preview/staging URLs left in source
- Domain configuration consistent across all surfaces

**Remaining technical debt:** none found

---

## Test Dataset Seed — Phase 5 Report

**Files created:**
- `migrations/005_seed_defence_energy_test.sql`

**Files changed:** none

**What was implemented:**
- Full TRUNCATE → seed → validate migration
- 10 competitors (5 defence, 5 energy) with realistic URLs
- 40 monitored pages (4 per competitor)
- 110 extraction rules (11 per competitor)
- PL/pgSQL validation with RAISE EXCEPTION on count mismatch

**Risks avoided:**
- Migration safe to re-run (always truncates first)
- Validation step prevents partial seed from being silently accepted
- SaaS tables (organizations, alerts, etc.) explicitly NOT touched
- FK-safe TRUNCATE ordering (CASCADE handles child table cleanup)

**Remaining operational step:**
- Run `migrations/005_seed_defence_energy_test.sql` in Supabase SQL editor (service role)
- Then trigger `fetch-snapshots` to start the pipeline

---

## Build Verification

All phases passed TypeScript type-check (`npx tsc --noEmit`) with exit code 0. No type errors introduced.
