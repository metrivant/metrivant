# Metrivant — Known Limitations

## Architecture Limitations

### Single-tenant per user
Each user belongs to exactly one organization. Multi-user teams (multiple logins sharing one org) are not implemented. The `organizations` table has `owner_id` as a unique key — one org per user.

**Impact**: Cannot share a radar between team members. Each person has their own isolated view.

### Single radar per org
Each organization tracks one set of competitors. There is no concept of multiple "radars" or watchlists per account.

### No real-time updates
The radar page is a server-rendered snapshot fetched at load time. New signals don't push to the browser — the user must refresh to see new data.

**Impact**: Intelligence can be up to several hours stale (pipeline runs every 6h). No WebSocket or SSE implementation.

### Pipeline latency: up to 6+ hours
The end-to-end pipeline runs every 6 hours. A competitor change detected on Monday at 09:01 UTC (just after a pipeline run) won't appear until ~15:00 UTC at the earliest.

### Baseline establishment delay
A new competitor won't generate signals until at least 2 pipeline cycles have run:
- Cycle 1: fetch snapshot, extract sections, establish baseline
- Cycle 2: fetch again, compare to baseline → first diffs possible

Minimum time from adding a competitor to first signal: ~12-18 hours.

---

## Data Limitations

### Extraction relies on CSS selectors
Sections are extracted using CSS selectors (Cheerio). If a competitor website uses JavaScript-rendered content (React, Next.js, etc.), the HTML snapshot won't include the rendered content — only the server-rendered HTML.

**Impact**: Competitors with fully SPA-rendered pages may have sparse or empty extractions. The extraction rules use generic selectors (`h1`, `h2`, `main`, `a`) which work best on traditional HTML pages.

### Selector drift
If a competitor website restructures its HTML (class names change, section layout changes), extraction rules may start returning empty or irrelevant content. Rules must be maintained manually.

### No JavaScript execution
The HTTP fetch stage does not run a headless browser — it issues a raw HTTP GET. JavaScript is not executed.

### Noise filtering
Section diffs go through `unconfirmed → confirmed` states to filter noise. Fast-changing content (timestamps, ad blocks, rotating banners) may be marked as `unstable` rather than generating signals. This is intentional but means some real changes may be filtered.

---

## Signal Limitations

### Signal taxonomy is fixed
Signal types (`price_point_change`, `feature_launch`, etc.) are determined by the interpretation stage. Adding new signal types requires a code change and potentially a schema migration.

### GPT-4 interpretation is probabilistic
While detection is deterministic, interpretation is probabilistic. Confidence scores vary. Strategic implications may occasionally be inaccurate or over-broad.

### No signal deduplication across competitors
If 3 competitors all add a "free tier" — 3 separate signals fire, 3 separate alerts send. There is no cross-competitor signal clustering at the alert level (though `strategic_analysis` does provide cross-competitor insights).

---

## Email Limitations

### No unsubscribe mechanism
Transactional emails have no unsubscribe link. Acceptable for early B2B product where email volume is low, but should be added before significant scale.

### FROM_EMAIL override is all-or-nothing
Setting `FROM_EMAIL` overrides all three sender addresses (hello, alerts, briefs) to the same value. Differentiated sender addresses require removing the override.

### Welcome email fires on form submit
The welcome email fires when the signup form is submitted, before Supabase confirms the email address. If a user abandons the confirmation flow, they still receive a welcome email.

---

## Analytics Limitations

### Server-side events use email as distinct_id
Some server-side PostHog events use `user.email ?? user.id` as `distinct_id`. If the user's PostHog client identity uses `user.id`, events may not stitch correctly in PostHog's identity graph.

**Note**: `PostHogIdentify` on the client uses `userId` (UUID), matching the Supabase user ID. Server routes that use email may create split identities in PostHog unless PostHog's `alias` feature is used.

---

## Billing / Monetization Limitations

### No payment processing
The billing page (`app/app/billing/page.tsx`) is a shell with no payment integration. There is no Stripe or Paddle integration.

### No plan enforcement at data layer
Users can add unlimited competitors regardless of any "plan" they're on. Plan enforcement (competitor limits, alert limits, etc.) is not implemented at the database level.

---

## Operational Limitations

### No admin panel
There is no admin dashboard. All operational monitoring requires direct Supabase SQL queries (see `docs/OPERATIONS.md`).

### No automated selector health monitoring
Selector health (empty extractions, suspect validations) requires manual SQL queries. There is no automated alert if selectors start failing.

### No test suite
There are no automated tests. Correctness is verified by TypeScript type-checking and manual review.

### Vercel function timeout
Each pipeline stage runs within Vercel's function timeout (10 seconds on Hobby, 60 seconds on Pro, up to 900 seconds on Enterprise). For large competitor lists, the pipeline stages may need to be chunked or moved to longer-running compute.

**Current status**: 10 competitors × 4 pages = 40 monitored pages. Well within Vercel Pro limits.

---

## Deferred Features (Explicit Non-Implementations)

These are intentional deferrals, not oversights:

- Multi-user org support
- Custom alert thresholds per user
- Outbound webhooks
- External API access for customers
- Mobile optimization
- Headless browser for JS-rendered pages
- Real-time push updates (WebSocket/SSE)
- Automated selector maintenance
- Unsubscribe mechanism
- Payment processing / plan enforcement
- Admin panel
- Automated testing suite
