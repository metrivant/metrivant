# Metrivant — Backend Architecture

## Overview

The backend is a separate Vercel project (`metrivant-runtime`). It contains only API handlers — no pages, no UI. Each handler is invoked by Vercel cron on a staggered schedule every 6 hours.

All handlers are **stateless**: they read current state from Supabase, advance it, and write back. No in-memory state, no queues, no background workers.

## Directory Structure

```
metrivant/
├── api/
│   ├── fetch-snapshots.ts          # Stage 1: HTTP GET competitor pages
│   ├── extract-sections.ts         # Stage 2: CSS selector extraction
│   ├── build-baselines.ts          # Stage 3: establish stable reference state
│   ├── detect-diffs.ts             # Stage 4: compare to baseline
│   ├── detect-signals.ts           # Stage 5: elevate confirmed diffs
│   ├── interpret-signals.ts        # Stage 6: AI annotation
│   ├── update-signal-velocity.ts   # Stage 7: velocity scoring
│   ├── detect-movements.ts         # Stage 8: cluster into movements
│   ├── radar-feed.ts               # API: serve radar_feed view
│   ├── competitor-detail.ts        # API: serve competitor signals/movements
│   ├── onboard-competitor.ts       # API: add competitor to pipeline
│   ├── generate-brief.ts           # API: generate weekly brief
│   └── health.ts                   # API: health check endpoint
│
├── lib/
│   ├── supabase.ts                 # Service-role Supabase client
│   ├── sentry.ts                   # Sentry init
│   ├── openai.ts                   # OpenAI client
│   ├── database.types.ts           # Generated Supabase types
│   ├── withCronAuth.ts             # Auth middleware for cron handlers
│   └── withSentry.ts               # Error boundary wrapper
│
├── migrations/
│   ├── 001_patterns.sql
│   ├── 002_strategic_movements_dedup.sql
│   ├── 003_interpretations_prompt_version.sql
│   ├── 004_section_diffs_dedup.sql
│   └── 005_seed_defence_energy_test.sql
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
├── package.json
├── tsconfig.json
├── vercel.json
├── CLAUDE.md
└── .env.example
```

## Handler Pattern

All pipeline handlers follow this pattern:

```typescript
import { supabase } from "../lib/supabase";
import { withCronAuth } from "../lib/withCronAuth";
import { withSentry } from "../lib/withSentry";

async function handler(req: Request): Promise<Response> {
  // 1. Auth check (via withCronAuth middleware)
  // 2. Read qualifying rows from Supabase
  // 3. Process each row
  // 4. Write state back to Supabase
  // 5. Return summary JSON
  return Response.json({ ok: true, job: "handler-name", processed: n });
}

export default withSentry(withCronAuth(handler));
```

## Auth Middleware (`lib/withCronAuth.ts`)

All pipeline handlers are protected by `Authorization: Bearer {CRON_SECRET}`. Vercel cron injects the secret automatically. Direct HTTP calls require the header.

```typescript
export function withCronAuth(handler: Handler): Handler {
  return async (req: Request) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return Response.json({ error: "CRON_SECRET not set" }, { status: 500 });
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req);
  };
}
```

## Supabase Client (`lib/supabase.ts`)

Service-role client — bypasses RLS. All backend operations require full read/write access to pipeline tables.

```typescript
export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

Note: The backend uses `SUPABASE_URL` (not `NEXT_PUBLIC_SUPABASE_URL` as the frontend does).

## Sentry (`lib/sentry.ts`)

Initialized on module load. Traces at 5% in production, 100% in development. Release tagged with Git commit SHA via `VERCEL_GIT_COMMIT_SHA`.

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
});
```

## OpenAI (`lib/openai.ts`)

Simple client initialization. Used exclusively by `interpret-signals` (annotation) and `generate-brief` (synthesis).

```typescript
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

## Key API Endpoints

### GET /api/radar-feed?limit=N

Returns `RadarFeedResponse` with enriched competitor array from the `radar_feed` Supabase VIEW.

Response shape:
```json
{
  "ok": true,
  "job": "radar-feed",
  "rowsReturned": 10,
  "runtimeDurationMs": 120,
  "data": [
    {
      "competitor_id": "uuid",
      "competitor_name": "Lockheed Martin",
      "website_url": "https://lockheedmartin.com",
      "signals_7d": 3,
      "weighted_velocity_7d": 0.82,
      "last_signal_at": "2026-03-11T10:30:00Z",
      "latest_movement_type": "product_expansion",
      "latest_movement_confidence": 78,
      "latest_movement_signal_count": 3,
      "latest_movement_velocity": 0.82,
      "latest_movement_summary": "...",
      "momentum_score": 0.65
    }
  ]
}
```

### GET /api/competitor-detail?id={uuid}

Returns full detail for a single competitor: signals, movements, monitored pages.

Response shape:
```json
{
  "competitor": { "id": "uuid", "name": "...", "website_url": "..." },
  "movements": [{ "movement_type": "...", "confidence": 78, ... }],
  "signals": [{ "id": "uuid", "signal_type": "...", "severity": "...", ... }],
  "monitoredPages": [{ "page_type": "homepage" }]
}
```

## Database Migrations

Backend migrations are in `/home/arcmatrix93/metrivant/migrations/`:

| File | Purpose |
|------|---------|
| `001_patterns.sql` | Pattern detection layer schema |
| `002_strategic_movements_dedup.sql` | Unique constraint on strategic_movements |
| `003_interpretations_prompt_version.sql` | Add prompt_version + prompt_hash to interpretations |
| `004_section_diffs_dedup.sql` | Unique constraint on section_diffs |
| `005_seed_defence_energy_test.sql` | Test dataset: 10 defence/energy competitors |

**Run order matters** — apply sequentially in Supabase SQL editor.

## Environment Variables

```bash
# Required
SUPABASE_URL=                    # Supabase project URL (note: no NEXT_PUBLIC prefix)
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (bypasses RLS)
OPENAI_API_KEY=                  # GPT-4 access
CRON_SECRET=                     # Shared secret (must match frontend)

# Optional
SENTRY_DSN=                      # Error tracking (skip for dev)
```
