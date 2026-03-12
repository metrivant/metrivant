# Metrivant — Architecture

## Architectural Principles

1. **Simplicity over cleverness** — no abstractions unless they demonstrably reduce complexity
2. **Determinism over magic** — every pipeline step has deterministic inputs and outputs
3. **Legibility over abstraction** — any engineer should be able to read a handler and understand exactly what it does
4. **Small safe changes over large rewrites** — prefer extending existing structure
5. **Deletion over bloat** — remove dead code rather than leaving it commented out
6. **Supabase as the system's state machine** — not Redis, not queues, not in-memory state

## High-Level Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                          GitHub                                   │
│                    (source of truth for code)                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │ deploys to
          ┌────────────────┴────────────────┐
          ▼                                 ▼
┌─────────────────────┐         ┌───────────────────────┐
│   Vercel: radar-ui  │         │  Vercel: metrivant-    │
│  (Next.js frontend) │         │  runtime (backend)     │
│  metrivant.com      │◄────────│  metrivant-runtime.    │
│                     │  API    │  vercel.app            │
│  Cron: UI-layer     │  calls  │                        │
│  Cron: check-signals│         │  Cron: full pipeline   │
│  Cron: generate-    │         │  every 6h              │
│  brief (weekly)     │         │                        │
└──────────┬──────────┘         └──────────┬─────────────┘
           │                               │
           │ both write/read               │
           ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Supabase (PostgreSQL)                      │
│                                                                   │
│  Pipeline tables:    competitors, monitored_pages, snapshots,    │
│                      page_sections, section_baselines,            │
│                      section_diffs, signals, interpretations,    │
│                      strategic_movements, radar_feed (view)       │
│                                                                   │
│  SaaS tables:        organizations, tracked_competitors, alerts,  │
│                      momentum, weekly_briefs, strategic_insights, │
│                      competitor_positioning                       │
└──────────────────────────────────────────────────────────────────┘
           │
           │ for interpretation only
           ▼
┌─────────────────────┐
│       OpenAI        │
│  (GPT-4 annotation) │
└─────────────────────┘
```

## Two-Database Mental Model

While there is only one Supabase project, the tables serve two distinct roles:

### Pipeline Tables (backend-owned)
These advance through deterministic state transitions via the backend cron pipeline:
- `competitors` — entities being monitored
- `monitored_pages` — specific URLs to track per competitor
- `extraction_rules` — CSS selectors and extraction parameters
- `snapshots` — raw HTML captures
- `page_sections` — extracted structured sections
- `section_baselines` — stable reference state per section
- `section_diffs` — detected changes vs baseline
- `signals` — elevated strategic events
- `interpretations` — AI annotations on signals
- `strategic_movements` — clustered movement patterns
- `radar_feed` — Supabase VIEW joining all of the above

### SaaS Tables (frontend-owned)
These are managed by the frontend API routes:
- `organizations` — user org mapping (one per user currently)
- `tracked_competitors` — user-added competitors (seeds `competitors` table)
- `alerts` — generated signal alerts for users
- `momentum` — historical velocity scoring
- `weekly_briefs` — AI-generated weekly intelligence reports
- `strategic_insights` — cross-competitor pattern analysis
- `competitor_positioning` — market map position data

## Request Flow: Radar Page Load

```
Browser → GET /app
  → app/app/layout.tsx (auth guard: redirect to /login if no session)
  → app/app/page.tsx (server component)
      → getRadarFeed() in lib/api.ts
          → fetch RADAR_API_BASE_URL/api/radar-feed (backend)
              → SELECT * FROM radar_feed (Supabase view)
          → returns RadarCompetitor[]
      → renders <Radar competitors={...} />
      → renders <RadarViewedTracker /> (fires PostHog radar_viewed)
```

## Request Flow: Competitor Detail

```
Browser clicks radar blip
  → Radar.tsx handleBlipClick
      → capture("competitor_selected") → PostHog
      → setSelectedId(id)
  → useEffect detects selectedId change
      → fetch /api/competitor-detail?id=...
          → app/api/competitor-detail/route.ts (proxy)
              → fetch RADAR_API_BASE_URL/api/competitor-detail?id=...
                  → Supabase: signals, movements, monitored_pages
          → returns CompetitorDetail
      → capture("competitor_detail_opened") → PostHog
      → setDetail(json)
  → Detail drawer renders (right side)
```

## Request Flow: Pipeline (every 6 hours)

```
Vercel cron triggers: /api/fetch-snapshots
  → fetch HTML from all active monitored_pages
  → INSERT INTO snapshots (sections_extracted = false)

10 minutes later: /api/extract-sections
  → SELECT snapshots WHERE sections_extracted = false
  → apply extraction_rules (cheerio CSS selectors)
  → INSERT INTO page_sections
  → UPDATE snapshots SET sections_extracted = true

5 minutes later: /api/build-baselines
  → SELECT page_sections WHERE validation_status = 'valid'
  → UPSERT section_baselines

5 minutes later: /api/detect-diffs
  → compare current vs baseline hashes
  → INSERT section_diffs with status unconfirmed → confirmed

5 minutes later: /api/detect-signals
  → SELECT section_diffs WHERE status = 'confirmed' AND signal_detected = false
  → INSERT signals (status = 'pending')

5 minutes later: /api/interpret-signals
  → FOR UPDATE SKIP LOCKED (atomic claim, 10 at a time)
  → OpenAI call for each signal
  → INSERT interpretations
  → UPDATE signals SET status = 'interpreted'

5 minutes later: /api/update-signal-velocity
  → compute weighted_velocity_7d per competitor
  → UPDATE competitors

5 minutes later: /api/detect-movements
  → cluster signals into strategic_movements
  → UPSERT strategic_movements
```

## Security Architecture Overview

- All pipeline handlers validate `Authorization: Bearer {CRON_SECRET}`
- Supabase RLS enabled on all SaaS tables (row-level by org_id)
- Service role key used only in specific server routes requiring RLS bypass
- Anon key used for auth and user-scoped queries
- Security headers enforced globally via next.config.ts

## Failure Modes and Recovery

| Failure | Recovery |
|---------|----------|
| Signal stuck in `interpreting` | Auto-reset after 30min via recovery query |
| Snapshot fetch fails | `retry_count` + `last_error` tracked; dead letter at 3 retries |
| Section extraction empty | `validation_status = 'suspect'` or `'failed'` — excluded from pipeline |
| Diff unstable | `status = 'unstable'` — excluded from signal detection |
| Email delivery fails | Logged, non-blocking — product surfaces unaffected |
| PostHog event fails | Fire-and-forget — never blocks product |
