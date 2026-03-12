# Metrivant — Handover Instructions

This document is for an AI system or new engineer taking over Metrivant development. Read this first.

---

## Before You Make Any Change

Follow this invariant workflow from CLAUDE.md:

```
1. Read CLAUDE.md in the project root
2. Read the relevant files before editing
3. Understand the data flow before touching anything
4. Propose the smallest safe plan
5. List exact files to change
6. Implement only what was approved
7. Run: npx tsc --noEmit
8. Report: files changed, what improved, risks avoided
```

**Do not make changes without reading first.**

---

## Critical Architecture Rules

### 1. Do not change backend API response shapes
`lib/api.ts` defines the contracts between frontend and backend. The types `RadarCompetitor`, `CompetitorDetail`, `CompetitorSignal`, `CompetitorMovement` are in use in multiple components. Changing these requires coordinated changes in both projects.

### 2. Do not add npm packages without justification
The project is intentionally lean:
- No ORM (raw Supabase client)
- No email SDK (raw fetch)
- No state management library (React state + server components)
- No form library

New dependencies require explicit justification and approval.

### 3. Supabase is the state machine — do not add external state
No Redis, no queues, no background workers. State lives in Supabase rows.

### 4. The radar is the product
Do not redesign the primary surface to be feed-first. The radar visualization is intentional.

### 5. PostHog is non-blocking
All analytics calls use `void` or are fire-and-forget. Never make analytics block a user-facing response.

### 6. Email is non-blocking
All email sends use `void sendEmail(...)`. Email failures are logged but never propagate to users.

---

## Project Locations

| What | Where |
|------|-------|
| Frontend source | `/home/arcmatrix93/metrivant/radar-ui/` |
| Backend source | `/home/arcmatrix93/metrivant/` (root) |
| Backend pipeline handlers | `/home/arcmatrix93/metrivant/api/` |
| Frontend API routes | `/home/arcmatrix93/metrivant/radar-ui/app/api/` |
| Frontend components | `/home/arcmatrix93/metrivant/radar-ui/components/` |
| Shared lib (frontend) | `/home/arcmatrix93/metrivant/radar-ui/lib/` |
| Shared lib (backend) | `/home/arcmatrix93/metrivant/lib/` |
| Database migrations | `/home/arcmatrix93/metrivant/migrations/` (pipeline) |
| Database migrations | `/home/arcmatrix93/metrivant/radar-ui/migrations/` (SaaS) |
| Architecture docs | `/home/arcmatrix93/metrivant/docs/` |
| Engineering rules | `/home/arcmatrix93/metrivant/CLAUDE.md` |

---

## Immediate Operational Steps Required

### Step 1: Run Test Seed Migration
Execute in Supabase SQL Editor (requires service role access):

```
File: /home/arcmatrix93/metrivant/migrations/005_seed_defence_energy_test.sql
```

Expected counts after execution:
- 10 competitors
- 40 monitored_pages
- 110 extraction_rules
- 0 snapshots (pipeline hasn't run yet)

The migration includes validation assertions. If counts are wrong, it raises an exception before committing.

### Step 2: Trigger First Pipeline Run
Call each backend stage in sequence (requires `CRON_SECRET`):

```bash
BACKEND=https://metrivant-runtime.vercel.app
SECRET=<your CRON_SECRET>

# Run in order, ~30s between each
curl -X POST $BACKEND/api/fetch-snapshots -H "Authorization: Bearer $SECRET"
curl -X POST $BACKEND/api/extract-sections -H "Authorization: Bearer $SECRET"
curl -X POST $BACKEND/api/build-baselines -H "Authorization: Bearer $SECRET"
curl -X POST $BACKEND/api/detect-diffs -H "Authorization: Bearer $SECRET"
curl -X POST $BACKEND/api/detect-signals -H "Authorization: Bearer $SECRET"
curl -X POST $BACKEND/api/interpret-signals -H "Authorization: Bearer $SECRET"
curl -X POST $BACKEND/api/update-signal-velocity -H "Authorization: Bearer $SECRET"
curl -X POST $BACKEND/api/detect-movements -H "Authorization: Bearer $SECRET"
```

### Step 3: Verify Pipeline Health
Check in Supabase SQL Editor:

```sql
-- Snapshots fetched?
SELECT COUNT(*) FROM snapshots; -- should be ~40

-- Sections extracted?
SELECT COUNT(*) FROM page_sections; -- should be 100-440 depending on content

-- Baselines established?
SELECT COUNT(*) FROM section_baselines;

-- Competitors visible in radar_feed?
SELECT competitor_name, signals_7d, momentum_score FROM radar_feed;
```

### Step 4: Configure Resend DNS (for email)
In Resend dashboard:
1. Add `metrivant.com` as verified domain
2. Copy SPF/DKIM/DMARC records
3. Add to DNS provider
4. Verify domain in Resend (may take up to 48h for DNS propagation)
5. Test by triggering a signup

---

## Key Files to Understand

If you're new to the codebase, read these in order:

1. `CLAUDE.md` — engineering rules and philosophy
2. `lib/api.ts` — types and API contracts
3. `lib/posthog.ts` — analytics wrapper
4. `lib/email.ts` — email module
5. `app/app/layout.tsx` — auth guard
6. `app/app/page.tsx` — radar page (main product surface)
7. `components/Radar.tsx` — radar visualization (core UI)
8. `app/api/check-signals/route.ts` — alert pipeline
9. `app/api/generate-brief/route.ts` — weekly brief

For backend:
1. `lib/withCronAuth.ts` — auth middleware
2. `api/fetch-snapshots.ts` — pipeline entry point
3. `api/interpret-signals.ts` — AI annotation stage
4. `api/radar-feed.ts` — data serving

---

## How to Add a New Feature

### Adding a new page to the app

1. Create `app/app/your-feature/page.tsx` (server component by default)
2. Add auth is handled by `app/app/layout.tsx` — no additional auth needed
3. If analytics tracking needed: create a `YourFeatureTracker.tsx` client component, mount it in the page
4. Add nav link if appropriate

### Adding a new API route

1. Create `app/api/your-feature/route.ts`
2. If user-authenticated: use `createClient()` from `lib/supabase/server.ts`
3. If service-role required: use `createServiceClient()` from `lib/supabase/service.ts`
4. If cron-protected: add `CRON_SECRET` check (see `check-signals/route.ts` for pattern)
5. Add to `vercel.json` if it should be a cron

### Adding a new email type

1. Add `buildYourEmailHtml(...)` to `lib/email.ts`
2. Call `sendEmail({ ..., html: buildYourEmailHtml(...) })` in the relevant route
3. Use `void sendEmail(...)` — non-blocking

### Adding a new PostHog event (client)

1. Import `{ capture }` from `lib/posthog.ts`
2. Call `capture("event_name", { ...properties })`
3. Document in `analytics_posthog.md`

---

## Common Pitfalls

### "My server component is breaking PostHog"
PostHog JS is browser-only. `lib/posthog.ts` wraps it with `isActive()` checks. If you're calling `capture()` in a server component directly, move it to a `"use client"` tracker component.

### "Emails are not sending"
1. Check `RESEND_API_KEY` is set in Vercel env vars
2. Check `FROM_EMAIL` or that the sending domain is verified in Resend
3. Check Vercel function logs for `[email] Resend` error messages

### "CRON_SECRET errors on pipeline calls"
The secret must be identical in both Vercel projects. If you regenerate it, update both.

### "Competitors not appearing on radar"
Check `radar_feed` VIEW — if it returns rows, the UI is fine. If 0 rows, check `competitors` table is populated (run seed or add via onboarding).

### "Signals stuck in `interpreting`"
Run recovery SQL:
```sql
UPDATE signals SET status = 'pending'
WHERE status = 'interpreting'
AND updated_at < NOW() - INTERVAL '30 minutes';
```

### "TypeScript errors after my changes"
Run `npx tsc --noEmit` from `radar-ui/` directory. Fix all errors before committing.

---

## Deployment Checklist

Before deploying to production:

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] All new API routes are protected appropriately (session or CRON_SECRET)
- [ ] No new `NEXT_PUBLIC_` variables expose sensitive data
- [ ] No hardcoded URLs (use env vars)
- [ ] Email sends are `void` (non-blocking)
- [ ] PostHog calls are wrapped in `capture()` from `lib/posthog.ts`
- [ ] No new large dependencies added without justification
- [ ] Backend contracts unchanged (or both projects updated together)
