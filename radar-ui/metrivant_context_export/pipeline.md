# Metrivant — Backend Pipeline

## Overview

The pipeline is a deterministic state machine. Each stage reads a specific set of rows from Supabase, advances their state, and writes back. Stages are independent and idempotent. Safe to re-run.

```
competitors
→ monitored_pages
→ snapshots
→ page_sections
→ section_baselines
→ section_diffs
→ signals
→ interpretations
→ strategic_movements
→ radar_feed (VIEW)
→ UI
```

## Stage 1: fetch-snapshots

**Cron**: every 6h at :00 (`0 */6 * * *`)
**Handler**: `/api/fetch-snapshots.ts`

- Reads all active `monitored_pages`
- Issues HTTP GET to each URL with appropriate headers
- Computes `content_hash` of response body
- Marks as `is_duplicate = true` if hash matches last snapshot (no content change)
- Inserts into `snapshots` with `sections_extracted = false`
- Tracks `retry_count` and `last_error`; sets `status = 'failed'` after 3 failures

**Key fields set:**
```
snapshots.status = 'fetched'
snapshots.sections_extracted = false
snapshots.raw_html = <full HTML body>
snapshots.content_hash = sha256 of HTML
```

## Stage 2: extract-sections

**Cron**: every 6h at :10 (`10 */6 * * *`)
**Handler**: `/api/extract-sections.ts`
**Parser**: Cheerio (CSS selectors)

- Reads `snapshots WHERE sections_extracted = false AND is_duplicate = false`
- Loads `extraction_rules` for each `monitored_page`
- Applies each rule's `selector` via Cheerio
- Validates extracted content (length, pattern matching, structure type)
- Sets `validation_status`: `valid` | `suspect` | `failed`
- Writes `page_sections` rows
- Updates `snapshots.sections_extracted = true`

**Extraction rule fields:**
```
selector          — CSS selector string (e.g. "h1", "main", ".hero-text")
extract_method    — "text" | "html" | "structured"
section_type      — hero | headline | product_mentions | cta_blocks | announcements | pricing_references
min_length        — minimum content length to be valid
max_length        — maximum content length
required_pattern  — optional regex pattern content must match
structure_type    — "text" | "list" | "table"
```

**Only `validation_status = 'valid'` rows proceed.**

## Stage 3: build-baselines

**Cron**: every 6h at :15 (`15 */6 * * *`)
**Handler**: `/api/build-baselines.ts`

- Reads recently validated `page_sections`
- UPSERTs `section_baselines` keyed on `(monitored_page_id, section_type)`
- On first run: establishes baseline from current section
- On subsequent runs: updates `last_confirmed_at` if content matches
- Baseline represents the stable known state of a section

**Key fields:**
```
section_baselines.section_hash      — hash of stable content
section_baselines.section_text      — current baseline text
section_baselines.established_at    — when first set
section_baselines.last_confirmed_at — when last seen unchanged
```

## Stage 4: detect-diffs

**Cron**: every 6h at :20 (`20 */6 * * *`)
**Handler**: `/api/detect-diffs.ts`

- Compares `current_section.section_hash` to `baseline.section_hash`
- If hashes differ: creates `section_diff` with status `unconfirmed`
- On next run, if change persists: promotes to `confirmed`
- If change disappears: marks as `unstable`
- Only `confirmed` diffs proceed to signal detection

**Diff status transitions:**
```
unconfirmed → confirmed  (change persisted across runs)
unconfirmed → unstable   (change reverted)
confirmed                (proceed to signal detection)
```

**Dedup**: unique constraint on `(monitored_page_id, section_type, previous_section_id, current_section_id)` prevents duplicate diffs.

## Stage 5: detect-signals

**Cron**: every 6h at :25 (`25 */6 * * *`)
**Handler**: `/api/detect-signals.ts`

- Reads `section_diffs WHERE status = 'confirmed' AND signal_detected = false AND is_noise = false`
- Creates a `signal` for each qualifying diff
- Sets signal `status = 'pending'`
- Updates `section_diff.signal_detected = true`

**Signal types:**
- `price_point_change`
- `feature_launch`
- `feature_deprecation`
- `tier_change`
- `positioning_shift`
- (and others depending on section_type)

**Dedup**: unique constraint on `(section_diff_id, signal_type)`.

## Stage 6: interpret-signals

**Cron**: every 6h at :30 (`30 */6 * * *`)
**Handler**: `/api/interpret-signals.ts`

- Atomically claims up to 10 signals using `FOR UPDATE SKIP LOCKED`
- Sets claimed signals to `status = 'interpreting'`
- For each: constructs prompt with diff content and sends to OpenAI GPT-4
- OpenAI returns structured JSON: `summary`, `strategic_implication`, `recommended_action`, `urgency` (1-5), `confidence` (0-100)
- Inserts `interpretations` row
- Updates signal to `status = 'interpreted'`
- On failure: increments `retry_count`, resets to `'pending'` if below limit, marks `'failed'` at limit 5

**Stuck job recovery**: signals stuck in `'interpreting'` for >30 minutes are reset to `'pending'`.

**Atomic claim pattern:**
```sql
UPDATE signals
SET status = 'interpreting'
WHERE id IN (
  SELECT id FROM signals
  WHERE status = 'pending'
  ORDER BY detected_at
  LIMIT 10
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

## Stage 7: update-signal-velocity

**Cron**: every 6h at :35 (`35 */6 * * *`)
**Handler**: `/api/update-signal-velocity.ts`

- Computes `weighted_velocity_7d` per competitor based on recency-weighted signal count
- Updates `competitors.weighted_velocity_7d`
- Used by radar blip sizing and positioning

## Stage 8: detect-movements

**Cron**: every 6h at :40 (`40 */6 * * *`)
**Handler**: `/api/detect-movements.ts`

- Clusters recent signals into `strategic_movements`
- Groups by competitor + movement type
- Computes aggregate `confidence`, `signal_count`, `velocity`
- UPSERTs `strategic_movements`

**Movement types:**
- `pricing_move`
- `product_expansion`
- `positioning_shift`
- `talent_surge`
- `market_entry`
- `defensive_pivot`

**Dedup**: unique constraint on `(competitor_id, movement_type)` with update on conflict.

## radar_feed VIEW

The `radar_feed` view is a Supabase VIEW joining `competitors`, `monitored_pages`, signals aggregates, and `strategic_movements` to produce the per-competitor summary consumed by the UI.

Returns one row per competitor with:
- `competitor_id`, `competitor_name`, `website_url`
- `signals_7d` — signal count in last 7 days
- `weighted_velocity_7d` — velocity score
- `last_signal_at` — most recent signal timestamp
- `latest_movement_type`, `latest_movement_confidence`, `latest_movement_signal_count`
- `latest_movement_summary`
- `momentum_score` — derived priority score

**Key behavior**: the view uses LEFT JOINs, so competitors with zero signals still appear (with `signals_7d = 0`, `momentum_score = 0`). This means all competitors are visible on the radar immediately after being added.

## Pipeline Idempotency

Every stage is safe to re-run:
- Unique constraints prevent duplicate rows
- State flags (`sections_extracted`, `signal_detected`) prevent double-processing
- `FOR UPDATE SKIP LOCKED` prevents race conditions if two jobs overlap

## Test Dataset (migration 005)

A test seed migration at `migrations/005_seed_defence_energy_test.sql` provides 10 competitors for pre-launch testing:

**Defence (5)**: Lockheed Martin, Raytheon (RTX), Northrop Grumman, BAE Systems, General Dynamics

**Energy (5)**: ExxonMobil, Chevron, BP, Shell, TotalEnergies

Each has 4 monitored pages (homepage, newsroom, products, careers) and 11 extraction rules (110 total).

**To run**: Execute in Supabase SQL editor with service role. Then trigger `fetch-snapshots` to start the pipeline.
