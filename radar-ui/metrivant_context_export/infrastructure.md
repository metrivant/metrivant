# Metrivant — Infrastructure

## Provider Summary

| Service | Provider | Tier | Purpose |
|---------|----------|------|---------|
| Frontend hosting | Vercel | Pro | radar-ui Next.js app |
| Backend runtime | Vercel | Pro | Pipeline cron handlers |
| Database | Supabase | Pro | PostgreSQL state machine |
| AI | OpenAI | Pay-as-you-go | Signal interpretation |
| Error tracking | Sentry | Free/Team | Exception monitoring |
| Analytics | PostHog | Cloud | User event tracking |
| Email | Resend | Pay-as-you-go | Transactional emails |
| DNS/Domain | External | — | metrivant.com |
| Source control | GitHub | Free | Code repository |

## Vercel Project 1: radar-ui (Frontend)

**URL**: https://metrivant.com
**Framework**: Next.js 16.1.6 (App Router, Turbopack)
**Build command**: `next build`
**Output directory**: `.next`

**Cron jobs** (defined in `radar-ui/vercel.json`):
```json
[
  { "path": "/api/generate-brief",      "schedule": "0 8 * * 1"  },
  { "path": "/api/check-signals",       "schedule": "0 * * * *"  },
  { "path": "/api/update-momentum",     "schedule": "0 */6 * * *" },
  { "path": "/api/strategic-analysis",  "schedule": "0 8 * * *"  },
  { "path": "/api/update-positioning",  "schedule": "0 9 * * *"  }
]
```

**Cron schedule description:**
- `check-signals`: every hour — polls backend for new signals, sends alert emails
- `update-momentum`: every 6h — updates momentum scores in SaaS tables
- `strategic-analysis`: daily at 08:00 UTC — cross-competitor pattern analysis
- `update-positioning`: daily at 09:00 UTC — market map positioning update
- `generate-brief`: weekly Monday 08:00 UTC — AI weekly intelligence report

**Required env vars** (see `environment_variables.md` for full list):
- `RADAR_API_BASE_URL` — backend runtime URL
- `CRON_SECRET` — shared API secret (must match backend)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — service role (RLS bypass)
- `OPENAI_API_KEY` — for brief generation
- `RESEND_API_KEY` — for email
- `NEXT_PUBLIC_POSTHOG_KEY` — for client analytics
- `POSTHOG_API_KEY` — for server-side analytics
- `NEXT_PUBLIC_SITE_URL` — set to `https://metrivant.com`

## Vercel Project 2: metrivant-runtime (Backend)

**URL**: configurable via `RADAR_API_BASE_URL` — default fallback `https://metrivant-runtime.vercel.app`
**Runtime**: Node.js
**Type**: API-only (no pages)

**Cron jobs** (defined in `metrivant/vercel.json`):
```json
[
  { "path": "/api/fetch-snapshots",        "schedule": "0 */6 * * *"  },
  { "path": "/api/extract-sections",       "schedule": "10 */6 * * *" },
  { "path": "/api/build-baselines",        "schedule": "15 */6 * * *" },
  { "path": "/api/detect-diffs",           "schedule": "20 */6 * * *" },
  { "path": "/api/detect-signals",         "schedule": "25 */6 * * *" },
  { "path": "/api/interpret-signals",      "schedule": "30 */6 * * *" },
  { "path": "/api/update-signal-velocity", "schedule": "35 */6 * * *" },
  { "path": "/api/detect-movements",       "schedule": "40 */6 * * *" },
  { "path": "/api/generate-brief",         "schedule": "0 9 * * 1"   }
]
```

**Required env vars:**
- `SUPABASE_URL` — Supabase project URL (note: different var name from frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key
- `OPENAI_API_KEY` — for interpret-signals
- `CRON_SECRET` — must match frontend
- `SENTRY_DSN` — optional, error tracking

## Supabase

**Tier**: Pro (for daily backups, dedicated compute)
**Database**: PostgreSQL
**Auth**: Email/password (Supabase Auth)
**RLS**: Enabled on all SaaS tables

**Key Supabase features used:**
- Row Level Security (RLS) — user isolation
- Service Role Key — RLS bypass for admin operations
- Supabase SSR — cookie-based session management in Next.js App Router
- Supabase Views — `radar_feed` view for enriched competitor data
- PostgreSQL functions — PL/pgSQL for atomic operations

**Connection patterns:**
- Frontend (user-facing): anon key + SSR cookies → RLS enforced
- Frontend (admin routes like `check-signals`, `generate-brief`): service role → RLS bypassed
- Backend (pipeline): service role → RLS bypassed

## OpenAI

**Model**: GPT-4 (used in `interpret-signals`)
**Usage**: Structured JSON output — `summary`, `strategic_implication`, `recommended_action`, `urgency`, `confidence`
**Rate limits**: handled via retry logic; 5 retries max per signal before `status = 'failed'`
**Also used in**: `generate-brief` — weekly intelligence synthesis

## Sentry

**SDK**: `@sentry/node` v10
**Init**: `lib/sentry.ts` — DSN from env, 5% trace sampling in production
**Integration**: `lib/withSentry.ts` wrapper for cron handlers
**Environment tags**: uses `VERCEL_ENV` (production/preview/development)
**Release tracking**: uses `VERCEL_GIT_COMMIT_SHA`

## GitHub

**Purpose**: Source control only
**CI**: `.github/workflows/ci.yml` — likely type-check and lint
**Branches**: `main` is the production branch
**Deploy**: Vercel deploys automatically from GitHub push

## DNS Configuration

Domain: `metrivant.com`
- Root domain → radar-ui Vercel project
- All `NEXT_PUBLIC_SITE_URL` references point to `https://metrivant.com`
- Auth callbacks and redirects configured for `metrivant.com`
- No hardcoded preview or staging URLs in source code

## Security Headers (enforced via next.config.ts)

Applied to all routes (`/(.*)`):

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
X-DNS-Prefetch-Control: on
```

## Cost Profile

- Vercel Pro: $20/mo × 2 projects = $40/mo
- Supabase Pro: $25/mo
- OpenAI: pay-per-token (low volume: ~$5-20/mo depending on pipeline activity)
- Sentry: free tier or Team
- PostHog: free tier (up to 1M events/mo)
- Resend: free tier (3,000 emails/mo)

**Estimated total**: ~$70-90/mo for a solo founder early-stage deployment
