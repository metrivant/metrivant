# Vercel Function Duration Configuration

**Problem:** Vercel limits `vercel.json` `functions` block to 50 entries. We have 51 functions.

**Solution:** Set project default maxDuration via Vercel UI, only list exceptions in `vercel.json`.

---

## Configuration Strategy

1. **Vercel Project Settings:** Set default `maxDuration = 60` seconds
   - Settings → Functions → Max Duration: 60s

2. **vercel.json:** Only list functions needing 90s (11 total, well under 50 limit)

3. **30s functions:** Configure individually in Vercel UI if needed

---

## Function Duration Requirements

### 90s functions (11) — **in vercel.json**
Long-running AI/network operations requiring extended timeout:
- `synthesize-movement-narratives` — GPT-4o movement synthesis
- `generate-radar-narratives` — GPT-4o-mini narrative generation
- `generate-sector-intelligence` — GPT-4o cross-competitor analysis
- `onboard-competitor` — Multi-step competitor discovery + validation
- `expand-coverage` — Page discovery across competitors
- `heal-coverage` — Multi-page validation + repair
- `backfill-feeds` — Bulk feed ingestion (6 pools)
- `check-feed-health` — Cross-pool feed validation
- `resolve-coverage` — Multi-competitor resolution
- `repair-feeds` — AI-driven feed URL discovery
- `suggest-competitors` — GPT-4o competitor discovery

### 60s functions (21) — **use project default**
Network-bound operations (feed ingestion, AI validation):
- `ingest-feeds`, `ingest-careers`, `ingest-investor-feeds`, `ingest-product-feeds`
- `ingest-procurement-feeds`, `ingest-regulatory-feeds`, `ingest-media-feeds`
- `promote-feed-signals`, `promote-careers-signals`, `promote-investor-signals`
- `promote-product-signals`, `promote-procurement-signals`, `promote-regulatory-signals`
- `promote-media-signals`
- `interpret-signals` — GPT-4o-mini signal interpretation
- `retention` — Bulk DB cleanup
- `reconcile-pool-events` — Cross-pool deduplication
- `detect-pool-sequences` — Pattern detection
- `suggest-selector-repairs` — AI-driven CSS selector fixes
- `attribute-pool-contexts` — Context assignment
- `validate-interpretations`, `validate-movements` — GPT-4o-mini validation

### 30s functions (19) — **configure in Vercel UI if needed**
DB-only operations, no external API calls:
- `fetch-snapshots`, `extract-sections`, `build-baselines`, `detect-diffs`
- `detect-signals`, `detect-ambient-activity`, `update-pressure-index`
- `update-signal-velocity`, `detect-movements`, `promote-baselines`
- `watchdog`, `learn-noise-patterns`, `calibrate-weights`
- `detect-stale-competitors`, `retry-failed-stages`, `update-noise-baselines`
- `retrograde-signals`

---

## Deployment Instructions

1. **Push code** with updated `vercel.json` (11 functions only)
2. **Vercel UI:** Settings → Functions → Max Duration → 60s
3. **(Optional)** Configure 30s functions individually in Vercel UI if 60s default causes issues

---

## Why This Works

- Vercel `functions` block limit: 50 entries
- Our breakdown: 11 (in vercel.json) + 40 (use default) = 51 total
- 11 < 50 ✓ Deployment succeeds
- Project default (60s) covers majority of functions
- Only exceptions listed explicitly

---

## Maintenance

When adding new functions:
- 30s: No action needed (or add to Vercel UI)
- 60s: No action needed (uses project default)
- 90s: Add to `vercel.json` `functions` block

If total 90s functions exceeds 50: move to separate Vercel projects or serverless configs.
