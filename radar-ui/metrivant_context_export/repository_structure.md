# Metrivant — Repository Structure

## Top-Level Layout

The Metrivant codebase lives at `/home/arcmatrix93/metrivant/`. It contains two deployable projects:

```
/home/arcmatrix93/metrivant/
├── radar-ui/            ← Next.js frontend (deploys to metrivant.com)
├── api/                 ← Backend pipeline handlers (deploys to metrivant-runtime.vercel.app)
├── lib/                 ← Backend shared libraries
├── migrations/          ← Backend database migrations
├── docs/                ← Architecture documentation
├── package.json         ← Backend dependencies
├── tsconfig.json        ← Backend TypeScript config
├── vercel.json          ← Backend cron schedule
├── CLAUDE.md            ← Engineering rules for AI assistance
└── README.md
```

---

## Frontend: radar-ui/

```
radar-ui/
├── app/
│   ├── layout.tsx                     Root layout: Inter font, PostHogProvider
│   ├── page.tsx                       Landing/marketing page (public)
│   ├── globals.css                    Global CSS (Tailwind base + custom variables)
│   ├── error.tsx                      Next.js error boundary
│   ├── loading.tsx                    Root loading state
│   ├── manifest.ts                    Web app manifest metadata
│   ├── robots.ts                      /robots.txt generator
│   ├── sitemap.ts                     /sitemap.xml generator
│   │
│   ├── login/
│   │   └── page.tsx                   Email/password login form ("use client")
│   │
│   ├── signup/
│   │   └── page.tsx                   New account registration form ("use client")
│   │
│   ├── pricing/
│   │   └── page.tsx                   Pricing tiers page (public)
│   │
│   └── app/                           ← All routes here are auth-gated
│       ├── layout.tsx                 Auth guard: redirect to /login if no session
│       │                              Also mounts PostHogIdentify
│       ├── page.tsx                   MAIN RADAR PAGE (server component)
│       │                              Fetches radar_feed, renders Radar + RadarViewedTracker
│       │
│       ├── onboarding/
│       │   └── page.tsx               Add first competitor form
│       │
│       ├── settings/
│       │   └── page.tsx               Account settings
│       │
│       ├── billing/
│       │   └── page.tsx               Subscription management (placeholder)
│       │
│       ├── alerts/
│       │   ├── page.tsx               Alert feed with unread count
│       │   └── MarkReadButton.tsx     Mark-as-read action button
│       │
│       ├── briefs/
│       │   ├── page.tsx               Weekly brief list + viewer (server component)
│       │   ├── BriefViewer.tsx        Rich brief content renderer
│       │   └── BriefViewedTracker.tsx Client: fires brief_viewed on mount
│       │
│       ├── discover/
│       │   ├── page.tsx               Competitor discovery page
│       │   └── DiscoverClient.tsx     Search + add competitors (client component)
│       │
│       ├── strategy/
│       │   ├── page.tsx               Cross-competitor strategic analysis (server)
│       │   ├── StrategyTracker.tsx    Client: fires strategy_viewed on mount
│       │   └── StrategyActionButton.tsx  Client: copy action + fires event
│       │
│       ├── market-map/
│       │   ├── page.tsx               Market positioning page (server)
│       │   └── MarketMap.tsx          2D scatter plot (client component, D3 + Framer Motion)
│       │
│       └── lemonade/                  Experimental competitor discovery feature
│           └── LemonadeStreet.tsx     Client component
│
├── app/api/                           Next.js API routes (server-side only)
│   ├── auth/
│   │   ├── callback/route.ts          Supabase OAuth callback (exchange code → session)
│   │   └── signout/route.ts           Sign out + PostHog reset + redirect
│   │
│   ├── competitor-detail/
│   │   └── route.ts                   Proxy: GET → backend /api/competitor-detail
│   │
│   ├── check-signals/
│   │   └── route.ts                   Hourly cron: detect new signals, send alert emails
│   │                                  Uses service role. Fires first-signal or regular email.
│   │
│   ├── generate-brief/
│   │   └── route.ts                   Weekly cron: AI brief generation + email to all users
│   │
│   ├── events/
│   │   └── signup/route.ts            POST: track signup event + send welcome email
│   │
│   ├── onboard-competitor/
│   │   └── route.ts                   POST form: add competitor, send confirmation email
│   │
│   ├── discover/
│   │   └── track/route.ts             POST: add competitor from discovery feature
│   │
│   ├── alerts/
│   │   ├── route.ts                   GET: fetch alerts for authenticated user
│   │   └── read/route.ts              POST: mark alerts as read
│   │
│   ├── update-momentum/
│   │   └── route.ts                   6h cron: update momentum scores in SaaS tables
│   │
│   ├── momentum/
│   │   └── history/route.ts           GET: momentum history for market map
│   │
│   ├── strategic-analysis/
│   │   └── route.ts                   Daily cron: cross-competitor pattern detection
│   │
│   └── update-positioning/
│       └── route.ts                   Daily cron: update market map positions
│
├── components/
│   ├── Radar.tsx                      Main radar visualization (~1500 lines)
│   │                                  SVG canvas, D3 blips, Framer Motion sweep
│   ├── MomentumSparkline.tsx          Velocity trend mini-chart
│   ├── NotificationBell.tsx           Alert count badge in nav
│   ├── PostHogProvider.tsx            PostHog SDK initialization wrapper
│   ├── PostHogIdentify.tsx            Identifies user on authenticated pages
│   ├── PublicNav.tsx                  Navigation for landing/marketing pages
│   └── RadarViewedTracker.tsx         Client: fires radar_viewed on mount
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  createBrowserClient (client-side)
│   │   ├── server.ts                  createServerClient + cookies (server-side)
│   │   └── service.ts                 createClient with service role (RLS bypass)
│   ├── api.ts                         Types (RadarCompetitor, CompetitorDetail) + fetchers
│   ├── posthog.ts                     Canonical PostHog: capture(), identify(), reset()
│   ├── email.ts                       Canonical Resend: sendEmail() + email templates
│   ├── alert.ts                       Alert email template (buildAlertEmailHtml)
│   ├── brief.ts                       Brief generation + email template
│   ├── catalog.ts                     Competitor catalog utilities
│   ├── format.ts                      formatRelative() + other formatters
│   ├── momentum.ts                    Momentum score utilities
│   ├── positioning.ts                 Market map positioning utilities
│   └── strategy.ts                    Strategic analysis utilities
│
├── migrations/                        UI-layer SQL migrations (SaaS tables)
│   ├── 001_saas_foundation.sql        organizations, tracked_competitors
│   ├── 002_competitor_catalog.sql     Catalog utilities
│   ├── 003_weekly_briefs.sql          weekly_briefs table
│   ├── 004_alerts.sql                 alerts table + RLS
│   ├── 005_momentum.sql               momentum table
│   ├── 006_strategic_insights.sql     strategic_insights table
│   └── 007_market_map.sql             competitor_positioning table
│
├── package.json                       Dependencies (see frontend_architecture.md)
├── next.config.ts                     Security headers, Turbopack config
├── tsconfig.json                      TypeScript: strict, bundler resolution
├── postcss.config.mjs                 Tailwind v4 PostCSS plugin
├── eslint.config.mjs                  ESLint config (next/eslint-config-next)
├── vercel.json                        Frontend cron schedules
├── .env.example                       Environment variable reference (no values)
└── CLAUDE.md                          Engineering rules for this repo
```

---

## Backend: metrivant/ (root)

```
metrivant/
├── api/
│   ├── fetch-snapshots.ts             Pipeline stage 1: HTTP crawl
│   ├── extract-sections.ts            Pipeline stage 2: Cheerio CSS extraction
│   ├── build-baselines.ts             Pipeline stage 3: establish stable reference
│   ├── detect-diffs.ts                Pipeline stage 4: compare to baseline
│   ├── detect-signals.ts              Pipeline stage 5: elevate confirmed diffs
│   ├── interpret-signals.ts           Pipeline stage 6: GPT-4 annotation
│   ├── update-signal-velocity.ts      Pipeline stage 7: velocity scoring
│   ├── detect-movements.ts            Pipeline stage 8: cluster into movements
│   ├── radar-feed.ts                  API: serve radar_feed VIEW
│   ├── competitor-detail.ts           API: signals + movements for one competitor
│   ├── onboard-competitor.ts          API: add competitor to pipeline
│   ├── generate-brief.ts              API: weekly brief synthesis
│   └── health.ts                      GET /api/health → 200 OK
│
├── lib/
│   ├── supabase.ts                    Service-role Supabase client
│   ├── sentry.ts                      Sentry init (optional)
│   ├── openai.ts                      OpenAI client
│   ├── database.types.ts              Generated Supabase TypeScript types
│   ├── withCronAuth.ts                Auth middleware: enforces CRON_SECRET
│   └── withSentry.ts                  Sentry error wrapper for handlers
│
├── migrations/                        Pipeline table SQL migrations
│   ├── 001_patterns.sql
│   ├── 002_strategic_movements_dedup.sql
│   ├── 003_interpretations_prompt_version.sql
│   ├── 004_section_diffs_dedup.sql
│   └── 005_seed_defence_energy_test.sql   ← Test dataset (not yet run)
│
├── docs/
│   ├── ARCHITECTURE_INDEX.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── PIPELINE_STATE_MACHINE.md
│   ├── SUPABASE_ARCHITECTURE.md
│   ├── SYSTEM_RUNTIME_FLOW.md
│   ├── MASTER_ARCHITECTURE_PLAN.md
│   ├── PATTERN_LAYER.md
│   └── OPERATIONS.md
│
├── .github/
│   └── workflows/
│       └── ci.yml                     GitHub Actions CI (type-check + lint)
│
├── package.json                       Backend deps: supabase-js, openai, cheerio, sentry
├── tsconfig.json                      TypeScript config
├── vercel.json                        Backend cron schedule
├── CLAUDE.md                          Engineering rules (same AI instructions)
├── README.md
└── .env.example
```

---

## Key File Relationships

```
app/app/page.tsx
  → lib/api.ts:getRadarFeed()
    → RADAR_API_BASE_URL/api/radar-feed
      → api/radar-feed.ts (backend)
        → Supabase: radar_feed VIEW

components/Radar.tsx
  → lib/posthog.ts:capture()
  → /api/competitor-detail (proxy)
    → app/api/competitor-detail/route.ts
      → RADAR_API_BASE_URL/api/competitor-detail
        → api/competitor-detail.ts (backend)
          → Supabase: signals, movements

app/app/layout.tsx
  → lib/supabase/server.ts:createClient()
  → components/PostHogIdentify.tsx
    → lib/posthog.ts:identify()

lib/email.ts
  ← app/api/events/signup/route.ts
  ← app/api/onboard-competitor/route.ts
  ← app/api/check-signals/route.ts
  ← app/api/generate-brief/route.ts
```
