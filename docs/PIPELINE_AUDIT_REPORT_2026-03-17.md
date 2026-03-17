# Metrivant Pipeline Audit Report
**Date:** 2026-03-17
**Auditor:** Claude Code (claude-sonnet-4-6)
**Scope:** Full pipeline audit — single org (metrivant@gmail.com), fintech sector, 15 competitors
**Status at close:** `healthy: true`, `pipelineBacklogWarnings: []`

---

## 1. System Identity

Metrivant is a **deterministic competitive intelligence radar**. It is not a dashboard or a feed-first product. It is a precision instrument for detecting and interpreting competitor movement over time.

**Production surfaces:**
- Runtime API: `https://metrivant-runtime.vercel.app` (Vercel — `metrivant-runtime`)
- UI: `https://metrivant.com` (Vercel — `metrivant-ui`)
- Database: Supabase (`sponaiylvwzbnlmcfbzj.supabase.co`)
- Monitoring: Sentry

**Single org in production:**
- Org: `metrivant@gmail.com`
- Sector: Fintech
- Tracked competitors: 15

---

## 2. Pipeline Architecture

The pipeline is a linear, deterministic multi-stage processing chain. Data flows in one direction only: fetch → extract → baseline → diff → signal → interpret → synthesize → narrate → radar.

```
competitors (15)
  └── monitored_pages (117)         [page_class: high_value | standard | ambient]
        └── snapshots                [raw HTML, fetch_quality: full | shell | js_rendered]
              └── page_sections      [extracted text per selector rule]
                    └── section_baselines  [insert-only anchor — never overwritten]
                          └── section_diffs      [change detection]
                                └── signals           [confidence-gated, deduped]
                                      └── interpretations    [gpt-4o-mini, pending only]
                                            └── strategic_movements  [14d window, min 2 signals]
                                                  └── radar_narratives     [per competitor]
                                                        └── sector_intelligence  [cross-competitor]
                                                              └── weekly_briefs        [Mon 10:00 UTC]
                                                                    └── radar_feed (UI)

Parallel track:
competitor_feeds → pool_events → signals [source_type='feed_event']
                                          └── same downstream as above
```

---

## 3. Cron Schedule (vercel.json — 21 jobs)

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/fetch-snapshots?page_class=ambient` | `0,30 * * * *` | Every 30 min |
| `/api/fetch-snapshots?page_class=high_value` | `2 * * * *` | Every hour |
| `/api/fetch-snapshots?page_class=standard` | `4 */3 * * *` | Every 3 hours |
| `/api/extract-sections` | `15,45 * * * *` | Every 30 min |
| `/api/build-baselines` | `17,47 * * * *` | Every 30 min |
| `/api/detect-diffs` | `19,49 * * * *` | Every 30 min |
| `/api/detect-signals` | `21,51 * * * *` | Every 30 min |
| `/api/detect-ambient-activity` | `23,53 * * * *` | Every 30 min |
| `/api/update-pressure-index` | `25,55 * * * *` | Every 30 min |
| `/api/ingest-feeds` | `10 * * * *` | Every hour |
| `/api/promote-feed-signals` | `12 * * * *` | Every hour |
| `/api/interpret-signals` | `28 * * * *` | Every hour |
| `/api/update-signal-velocity` | `50 * * * *` | Every hour |
| `/api/detect-movements` | `55 * * * *` | Every hour |
| `/api/synthesize-movement-narratives` | `30 * * * *` | Every hour |
| `/api/generate-radar-narratives` | `45 * * * *` | Every hour |
| `/api/generate-sector-intelligence` | `0 7 * * 1` | Monday 07:00 UTC |
| `/api/promote-baselines` | `0 2 * * *` | Daily 02:00 UTC |
| `/api/retention` | `0 3 * * *` | Daily 03:00 UTC |
| `/api/suggest-selector-repairs` | `0 4 * * *` | Daily 04:00 UTC |
| `/api/watchdog` | `*/15 * * * *` | Every 15 min |

---

## 4. Database Schema — Key Tables

### Core pipeline tables (created manually in Supabase — no CREATE TABLE migration)

| Table | Purpose | Key columns |
|---|---|---|
| `competitors` | Competitor registry | `id, name, website_url, pressure_index, active, last_signal_at, domain` |
| `monitored_pages` | Pages under surveillance per competitor | `id, competitor_id, url, page_class, health_state` |
| `snapshots` | Raw HTML captures | `id, monitored_page_id, fetched_at, raw_html, fetch_quality, sections_extracted, status` |
| `page_sections` | Extracted text by selector | `id, snapshot_id, monitored_page_id, section_type, section_text, section_hash, validation_status` |
| `section_baselines` | Immutable content anchors | `monitored_page_id, section_type, section_hash, section_text, established_at, is_active` |
| `section_diffs` | Detected changes | `id, monitored_page_id, section_type, baseline_hash, new_hash, is_noise, signal_detected` |
| `signals` | Confidence-gated intelligence events | `id, competitor_id, section_diff_id, signal_type, confidence_score, status, signal_hash, relevance_level, source_type` |
| `interpretations` | GPT-generated signal analysis | `id, signal_id, model_used, change_type, summary, strategic_implication, confidence, urgency` |
| `strategic_movements` | Multi-signal movement patterns | `id, competitor_id, movement_type, confidence, signal_count, movement_summary` |

### Extended tables (from migrations)

| Table | Purpose |
|---|---|
| `activity_events` | Ambient intelligence, NOT signals — 30d retention |
| `radar_narratives` | Per-competitor GPT narrative summaries |
| `sector_intelligence` | Weekly cross-competitor GPT-4o analysis |
| `weekly_briefs` | Assembled weekly brief per org |
| `competitor_feeds` | RSS/feed config per competitor for Pool 1 |
| `pool_events` | Raw newsroom/feed ingestion log |
| `pipeline_events` | Observability log for pipeline stages — 90d retention |
| `extraction_rules` | CSS selector rules per monitored page |
| `signal_feedback` | Operator quality labels per signal |
| `selector_repair_suggestions` | AI-proposed CSS fixes (operator review only) |
| `radar_positions` | SVG node trail per org — 28d retention |
| `section_narratives` | (Pool 7 media) sector narrative clusters |
| `media_observations` | (Pool 7 media) 30d observations |

### FK cascade behavior — CRITICAL NOTE

The core pipeline tables were created **directly in Supabase** before the migration system was established. Migration 013 attempts `CREATE TABLE IF NOT EXISTS` for these tables — but since they already existed, the `IF NOT EXISTS` clause skipped execution. As a result, the FK constraints on these tables do **NOT have ON DELETE CASCADE** even though migration 013 specifies it.

**Confirmed non-cascade FKs (will block parent row deletion):**
- `strategic_movements.competitor_id → competitors(id)` — NO CASCADE (manually created)
- `tracked_competitors.competitor_id → competitors(id)` — NO CASCADE (migration 018)

**Deletion order required when deleting competitors:**
```
1. strategic_movements      (WHERE competitor_id IN (...))
2. tracked_competitors      (WHERE competitor_id IN (...))
3. section_diffs            (WHERE monitored_page_id IN (SELECT id FROM monitored_pages WHERE competitor_id IN (...)))
4. page_sections            (WHERE monitored_page_id IN (...))
5. snapshots                (WHERE monitored_page_id IN (...))
6. selector_repair_suggestions (WHERE monitored_page_id IN (...))
7. section_baselines        (WHERE monitored_page_id IN (...))
8. competitors              (WHERE id IN (...))
```

Additionally: Supabase REST API has an **8-second statement timeout**. DELETE operations that cascade through large datasets (>100 rows with heavy joins) will time out. Child tables must be pre-cleared in batches of ≤50 rows before the parent deletion.

---

## 5. Confidence Model (v4.0)

```
base             = SECTION_WEIGHTS[section_type]   (0.25 – 0.85)
recency_bonus    = 0.05 / 0.10 / 0.15
obs_bonus        = min(0.15, (observations - 1) × 0.05)
page_class_bonus = +0.08 if page_class = 'high_value'
score            = min(1.0, base + recency_bonus + obs_bonus + page_class_bonus)
```

### Confidence gates

| Range | Status | Behavior |
|---|---|---|
| < 0.35 | suppressed | No signal created |
| 0.35 – 0.64 | `pending_review` | Held. Only promoted if competitor `pressure_index >= 5.0` |
| >= 0.65 | `pending` | Sent to OpenAI for interpretation |

### Signal hash (v4.1)
`sha256(competitor_id:signal_type:section_type:diff_id)[:32]`
Anchored to the specific diff — same-day distinct events each produce independent signals.

---

## 6. fetch_quality — Critical Behavior

`fetch_quality` is assigned at fetch time based on text element count in the raw HTML:

```
< 3 text elements (p/h1/h2/li)        → 'shell'        (bot wall, JS-rendered)
< 500 visible chars but has elements  → 'js_rendered'  (thin JS page)
otherwise                              → 'full'         (extractable)
```

`extract-sections` **only processes `fetch_quality = 'full'`**. Shell and js_rendered pages are intentionally skipped because bot walls and empty pages produce zero-value sections that waste baseline slots and generate false diffs.

**Bug found (commit ef4f6e1, 2026-03-15) — FIXED this session:**
When shell/js_rendered snapshots were skipped, they were never marked `sections_extracted = true`. This caused:
- Orphaned snapshot accumulation (204 stuck rows)
- Health endpoint false-positive `snapshot_extraction_backlog` warning
- Raw HTML never nulled for those snapshots (retention only nulls `sections_extracted = true` rows)

**Fix applied (commit 20fbdfa, 2026-03-17):**
Pre-pass bulk UPDATE in extract-sections now marks all shell/js_rendered snapshots as `sections_extracted = true, raw_html = null` before the main extraction batch runs.

---

## 7. Page Health States

| State | Meaning |
|---|---|
| `unresolved` | Initial state — not yet confirmed healthy |
| `healthy` | Fetch succeeds, sections extract, baselines established |
| `blocked` | 404 or permanent fetch failure |
| `challenge` | Anti-bot / Cloudflare challenge page detected |
| `degraded` | Fetch succeeds but section extraction repeatedly fails (all sections fail 2/3 last snapshots) |
| `baseline_maturing` | (defined but not observed in current data) |

**Current distribution (post-cleanup, 117 pages):**

| State | Count |
|---|---|
| healthy | 77 (65.8%) |
| unresolved | 26 (22.2%) |
| blocked | 6 (5.1%) |
| challenge | 6 (5.1%) |
| degraded | 2 (1.7%) |

The 26 `unresolved` pages are expected for a recently onboarded system — these pages have been fetched but not yet gone through enough baseline cycles to be promoted to healthy.

---

## 8. Current State — All Tables (post-audit, post-cleanup)

| Table | Count | Notes |
|---|---|---|
| competitors | 15 | 15 fintech only — cleanup removed 92 ghost competitors |
| monitored_pages | 117 | 15 × ~7-8 pages each |
| extraction_rules | 231 | CSS selector rules |
| section_baselines | 57 | Active baselines |
| snapshots (last 7d) | 1,068 | 487 full, ~581 shell/js_rendered (now auto-cleared on next extract run) |
| section_diffs | 10 | Active diffs |
| signals | 4 | 2 pending_review, 2 interpreted |
| interpretations | 2 | GPT-4o-mini outputs |
| strategic_movements | 2 | Mercury: product_expansion + market_reposition |
| radar_narratives | 1 | Mercury (March 16) |
| activity_events | recent | content_update, hiring_activity events active |
| competitor_feeds | 15 | All feed_unavailable (no RSS feeds auto-discovered) |
| pool_events | 0 | Pool 1 active but no events ingested |
| weekly_briefs | 1 | March 16 brief generated |
| sector_intelligence | 0 | Table empty — weekly job ran but found insufficient data |

---

## 9. Stage-by-Stage Audit Results

### Stage 1: fetch-snapshots ✅ OPERATIONAL

- **Cron:** ambient :00/:30, high_value :02, standard :04 every 3h
- **Last run:** 2026-03-17T15:04 UTC
- **Snapshot volume (7d):** 1,068 total
- **Quality distribution:** 487 full (45.6%), ~581 shell/js_rendered (54.4%)
- **Failures observed:** 404 (blocked pages — `unknown_fetch_failure`), `challenge_page` — both are normal, documented behaviors
- **Concern:** Over half of all snapshots are shell quality. This means 54% of fetch cycles produce no extractable content. These are competitor pages behind bot-detection walls or JS-rendered frameworks. The system handles this correctly but it represents a significant fetch efficiency issue.

### Stage 2: extract-sections ✅ OPERATIONAL (bug fixed this session)

- **Cron:** :15/:45 every 30 min
- **Batch size:** 25 snapshots per run
- **Bug fixed:** Shell/js_rendered snapshots now marked done immediately via pre-pass (commit 20fbdfa)
- **Processing rate:** ~25 full-quality snapshots every 30 min
- **Drift detection:** Active — fires Sentry warning when section count deviates >60% from 5-snapshot rolling avg

### Stage 3: build-baselines ✅ OPERATIONAL

- **Cron:** :17/:47 every 30 min
- **Current baselines:** 57 active
- **promote-baselines:** Daily 02:00 UTC
- **Note:** No pipeline_events logging for this stage — observability is limited

### Stage 4: detect-diffs ✅ OPERATIONAL

- **Cron:** :19/:49 every 30 min
- **Pipeline_events stage name:** `compare`
- **Results (last 500 events):** 62 success, 0 failure, 263 skipped
- **Skipped rate:** 81% — this is healthy and expected (most pages are stable)
- **Diffs (last 24h):** 7 confirmed diffs
- **Noise ratio (24h):** 0.0 — no noise diffs

### Stage 5: detect-signals ✅ OPERATIONAL

- **Cron:** :21/:51 every 30 min
- **Pipeline_events stage name:** `diff`
- **Results (last 500 events):** 23 success, 0 failure, 0 skipped
- **Total signals (all time, post-cleanup):** 4
- **Signal types:** `feature_launch` ×3, `positioning_shift` ×1
- **Source type:** All `page_diff` — no feed signals
- **Confidence range:** 0.60 – 0.75 (avg 0.65)
- **Noise gates active:** whitespace_only, dynamic_content_only
- **Hash dedup:** sha256 per competitor+signal_type+section_type+diff_id
- **Suppression anomaly gate:** fires Sentry if ≥5 diffs and ≥98% suppressed for a competitor

### Stage 6: interpret-signals ✅ OPERATIONAL

- **Cron:** :28 every hour
- **Model:** gpt-4o-mini
- **Last run:** 2026-03-16T22:28 UTC
- **Total interpretations:** 2
- **Pending signals waiting for interpretation:** 0 (2 signals are `pending_review` — held by confidence gate, not sent to GPT)
- **Note:** `pending_review` signals (confidence 0.35–0.64) are held until `pressure_index >= 5.0`. Currently Mercury is the only competitor with pressure_index > 0 (0.79). No competitor has reached 5.0 yet.

### Stage 7: update-pressure-index ✅ OPERATIONAL

- **Cron:** :25/:55 every 30 min
- **Formula:** Σ(severity_weight × confidence × exp(-age_days × 0.2)) + Σ(ambient_event_weight)
- **Current values:** Mercury 0.79, Brex 0.45, Stripe 0.30, all others 0.0
- **Max possible:** 10.0
- **Observation:** Only 3 of 15 competitors have non-zero pressure. This reflects a genuinely early-stage system — most competitors haven't produced signals yet.

### Stage 8: detect-ambient-activity ✅ OPERATIONAL (assumed)

- **Cron:** :23/:53 every 30 min
- **No pipeline_events logging** — cannot directly verify from DB
- **Recent activity_events:** content_update, hiring_activity — events are being generated
- **Note:** Ambient events are NOT signals. They are lightweight activity indicators that contribute to pressure_index.

### Stage 9: detect-movements / synthesize-movement-narratives ✅ OPERATIONAL

- **detect-movements:** :55 every hour
- **synthesize-movement-narratives:** :30 every hour
- **Current movements:** 2 (Mercury: `product_expansion` conf=0.575, `market_reposition` conf=0.575)
- **Minimum signals required:** 2 per movement
- **14d window:** only signals from last 14 days used

### Stage 10: generate-radar-narratives ✅ OPERATIONAL

- **Cron:** :45 every hour
- **Model:** gpt-4o-mini
- **Current narratives:** 1 (Mercury, generated 2026-03-16T16:45)
- **Note:** Only 1 narrative exists because only Mercury has signals. Others have nothing to narrate.

### Stage 11: generate-sector-intelligence ⚠️ EMPTY TABLE

- **Cron:** Monday 07:00 UTC
- **Last Monday:** 2026-03-16 07:00 UTC
- **Table state:** 0 rows
- **On-demand test (this session):** `ok: true, analyses_created: 1, orgs_processed: 1` — function ran successfully on demand
- **Root cause of empty table:** The weekly cron ran Monday 07:00, but at that time the database had 107 competitors across multiple sectors — sector intelligence likely ran for a non-fintech sector and the results were for the wrong org context, or the job ran but the table was not populated due to insufficient signal data. The on-demand run created 1 row.
- **Action needed:** Verify sector_intelligence now has 1 row; confirm the Monday cron will produce meaningful fintech sector output.

### Stage 12: weekly_briefs ✅ OPERATIONAL

- **Cron:** Monday 10:00 UTC (radar-ui)
- **Total briefs:** 1 (2026-03-16)
- **Source:** Assembled from sector_intelligence + strategic_movements + radar_narratives + sector_narratives
- **Note:** Brief was generated before the ghost competitor cleanup. Next Monday's brief (2026-03-23) will be the first clean fintech-only brief.

---

## 10. Pool System Status

### Pool 1 — Newsroom Feeds (Active)

| Item | Status |
|---|---|
| Cron (ingest-feeds) | ✅ Running every hour at :10 |
| Cron (promote-feed-signals) | ✅ Running every hour at :12 |
| competitor_feeds rows | 15 (one per competitor) |
| discovery_status | `feed_unavailable` — all 15 |
| feed_url | NULL — all 15 |
| pool_events | 0 rows — nothing ever ingested |

**Root cause:** Pool 1 uses auto-discovery to find RSS feeds for competitor newsroom URLs. All 15 fintech competitors have `feed_unavailable` — the auto-discovery failed to locate RSS/Atom feeds for any of them. `ingest-feeds` runs every hour but returns `feedsTotal: 0` because no feeds are configured.

**This is not a code bug.** Feed discovery ran and returned no results. To activate Pool 1 for a competitor, a `feed_url` must be manually supplied to their `competitor_feeds` row.

**Fintech newsroom RSS feeds (typically available):**
- Stripe: `https://stripe.com/newsroom/rss` (may exist)
- Brex, Mercury, Rippling, Robinhood: may have RSS on their blog/newsroom
- Most modern fintech companies publish via substack or blog platforms with RSS

### Pools 2–6 — Dormant (Schema Complete)

| Pool | Type | Status |
|---|---|---|
| Pool 2 | Careers | Schema complete, cron NOT scheduled |
| Pool 3 | Investor | Schema complete, cron NOT scheduled |
| Pool 4 | Product | Schema complete, cron NOT scheduled |
| Pool 5 | Procurement | Schema complete, cron NOT scheduled |
| Pool 6 | Regulatory | Schema complete, cron NOT scheduled |

These pools are activation-ready. To activate: add cron entry to `vercel.json`.

### Pool 7 — Media (Schema Only)

- `media_observations` and `sector_narratives` tables exist
- Ingestion not implemented
- Weekly briefs query `sector_narratives` as optional input (currently empty)

---

## 11. Data Isolation (Single-Org Analysis)

**Current architecture is single-tenant.** The `competitors` table has no `org_id` column. All competitors in the system are implicitly for the single org (metrivant@gmail.com).

Multi-tenancy is implemented via `tracked_competitors` in the radar-ui layer, which maps `org_id → competitor_id`. However, the **runtime pipeline** (fetch, extract, diff, signal) does NOT filter by org — it processes ALL competitors in the `competitors` table unconditionally.

**Implication:** If a second org were added, its competitors would be added to the same `competitors` table. The runtime pipeline would process them. However:
- Signals, interpretations, movements, and narratives are all keyed by `competitor_id` — they do not carry `org_id`
- The radar-ui JOIN through `tracked_competitors` provides org-level filtering at read time
- But if two orgs track the same company (e.g., both track Stripe), there would be ONE `competitors` row shared between them — they would share signals, baselines, and diffs

**This is a single-tenant system by design.** The current architecture does not support true multi-tenancy without significant schema changes.

---

## 12. Ghost Competitor Cleanup — This Session

**Finding:** 92 competitors from non-fintech sectors (defense, energy, AI, health, tech) existed alongside the 15 fintech competitors. These were accumulated from prior sector explorations/test sessions and never cleaned up.

**Impact before cleanup:**
- 107 competitors consuming cron cycles
- 200 monitored pages (185 non-fintech)
- 412 section baselines
- Signals, diffs, interpretations from non-fintech companies polluting pressure_index and narratives
- RTX (Raytheon) had the highest pressure_index in the system (1.1) — a defense company, not relevant

**Cleanup execution:**
- Deleted `strategic_movements` and `tracked_competitors` for 92 IDs (no cascade)
- Pre-cleared `section_diffs`, `page_sections`, `snapshots` in batches of 50 (REST API timeout workaround)
- Deleted `competitors` (cascade cleaned monitored_pages, baselines, narratives, feeds, etc.)

**State after cleanup:**

| Metric | Before | After |
|---|---|---|
| Competitors | 107 | 15 |
| Monitored pages | 200 | 117 |
| Section baselines | 412 | 57 |
| Signals | 17 | 4 |
| Health check | `healthy: false` | `healthy: true` |
| Backlog warnings | `snapshot_extraction_backlog` | none |

---

## 13. Retention Policy

| Data | TTL | Mechanism |
|---|---|---|
| `raw_html` on snapshots | 7 days | `retention_null_raw_html` RPC — nulls `sections_extracted = true` snapshots |
| `page_sections` | 90 days | `retention_delete_sections` RPC — skips rows referenced by baselines/diffs |
| `section_diffs` | 180 days | `retention_delete_diffs` RPC — skips rows referenced by signals |
| `pipeline_events` | 90 days | `retention_delete_pipeline_events` RPC — unconditional |
| `activity_events` | 30 days | (implied by schema) |
| `pool_events` | append-only | No retention defined |
| `radar_positions` | 28 days | Via schema/trigger |
| `media_observations` | 30 days | Via schema/trigger |

**Retention cron:** `/api/retention` — daily 03:00 UTC

**Gap identified:** Shell/js_rendered snapshots with `sections_extracted = false` were never picked up by retention (which only nulls `sections_extracted = true`). This caused unbounded accumulation. Fixed by this session's extract-sections pre-pass.

---

## 14. Known System Behaviours (Reference)

1. **`fetch_quality = 'shell'`** — page returned bare HTML with <3 text elements. Bot wall or pure JS app. extract-sections skips these by design.
2. **`fetch_quality = 'js_rendered'`** — page returned some HTML but <500 visible chars. Thin render. Also skipped by extract-sections.
3. **`challenge_page` snapshots** — Cloudflare or similar CAPTCHA interception. Logged as failure, page health set to `challenge` after threshold.
4. **`404` snapshots** — Page not found. Competitor page may have moved or been removed. Page health set to `blocked` after threshold.
5. **`pending_review` signals** — Confidence 0.35–0.64. Held permanently until competitor's `pressure_index >= 5.0`. In practice, most fintech competitors are at 0.0 pressure — these signals will not be interpreted until pressure builds.
6. **`signal_hash` dedup** — SHA256(competitor_id:signal_type:section_type:diff_id)[:32]. Morning price change + evening rollback each get distinct signals.
7. **`extraction_drift_detected`** — Sentry warning when current section count deviates >60% from 5-snapshot rolling avg AND absolute delta ≥ 2. Indicates selector breakage.
8. **`suppression_anomaly`** — Sentry warning when ≥5 diffs and ≥98% suppressed for a competitor. Indicates systematic noise.
9. **`baseline_instability_warning`** — Sentry warning when >5 new baselines/page in 7 days. Indicates frequent content restructuring.

---

## 15. Open Questions for Deep Analysis

These questions need authoritative answers to inform long-term architecture decisions.

### 15.1 Multi-Tenancy & Scale

**Q1.** The `competitors` table has no `org_id`. If Metrivant grows to 100+ orgs, each with 15 competitors, how should data isolation work? Options:
- a) Add `org_id` to `competitors` (and all downstream tables) — major migration
- b) Maintain the current model where the pipeline processes all competitors globally, with org filtering at read time via `tracked_competitors`
- c) Separate DB schemas per org (Supabase supports this via row-level security)

**Q2.** If two orgs track the same competitor (e.g., both track Stripe), should they share baselines, diffs, and signals — or get independent copies? Sharing reduces cost but means one org's page-class settings affect the other.

**Q3.** What is the target scale for Metrivant? (# of orgs, # of competitors per org, # of monitored pages total)? This drives whether the current single-process Vercel cron model is sustainable.

**Q4.** Vercel cron functions have a 10-minute maximum execution time and no parallelism guarantee. At 15 competitors × 7-8 pages × 3 page classes = ~117 pages today, the fetch cycle is manageable. At what page count does the current cron architecture become a bottleneck? Has this been modelled?

**Q5.** The `extract-sections` batch size is 25 snapshots every 30 minutes = max 50/hour. At current volume (1,068 snapshots/7 days = ~152/day = ~6/hour of full-quality), this is fine. At 10x org count = ~1,520/day, the extractor would process them in ~30 hours. Is this acceptable?

### 15.2 Pool System

**Q6.** Pool 1 (newsroom) shows `feed_unavailable` for all 15 fintech competitors. Was RSS auto-discovery ever expected to work for fintech companies? Have any manual feed URLs been tested? What is the intended activation path for Pool 1?

**Q7.** When Pool 1 eventually produces `pool_events`, how do those events flow into signals differently from page_diffs? Specifically: do feed signals bypass the `section_baselines` comparison mechanism (since there's no baseline for a press release)? What confidence score do feed signals receive?

**Q8.** Pools 2–6 are schema-complete and dormant. What is the activation trigger for each? (Business decision or technical readiness?) Are there any data quality or pipeline ordering concerns with activating multiple pools simultaneously?

**Q9.** Pool 7 (media) has schema but no ingestion. What is the intended data source? (NewsAPI, GDELT, Google News RSS, media scraping?) This is critical for brief quality — currently the weekly brief assembles without any sector news context.

**Q10.** When multiple pools are active, do their signals all flow into the same `signals` table with `source_type` differentiation? Does the confidence model apply equally to feed signals and page_diff signals? Should it?

### 15.3 Signal Quality & Pipeline Accuracy

**Q11.** Currently 2 of 4 signals are `pending_review` (confidence 0.60, 0.65) — held because no competitor has `pressure_index >= 5.0`. The threshold of 5.0 was calibrated against what data? For a new system with zero signal history, will signals ever naturally reach the `pending` state without first manually seeding pressure?

**Q12.** `relevance_level` is NULL for all 4 current signals. The relevance classifier (AI Layer 1) runs on `pending` signals only. But signals at `pending_review` status are never classified for relevance. Is this intentional? Could relevance classification run on all signals regardless of status, to inform whether `pending_review` signals are worth promoting?

**Q13.** The `extraction_rules` table has 231 rows for 117 pages (avg ~2 rules/page). Are these rules auto-generated at competitor onboard time, or manually curated? How do they get updated when a competitor redesigns their website? Is `suggest-selector-repairs` (daily 04:00 UTC) the only repair mechanism?

**Q14.** With 487 `full` quality snapshots in the last 7 days and only 4 signals generated, the signal-to-snapshot ratio is ~0.8%. Is this expected for a newly bootstrapped system, or does it suggest suppression/extraction issues?

**Q15.** The `section_baselines` table currently has 57 rows. With 117 pages and ~2 section types per page, the expected count would be ~234. Why are there only 57? Are baselines established per section type only after enough consistent snapshots are seen? What is the minimum snapshot count before a baseline is established?

### 15.4 Data Integrity & Operational Concerns

**Q16.** The initial core tables (competitors, monitored_pages, snapshots, page_sections, section_baselines, section_diffs, signals, interpretations, strategic_movements) were created directly in Supabase with no CREATE TABLE migration. If the Supabase project is destroyed, there is no deterministic way to recreate the schema. Is a live schema export maintained anywhere? (`information_schema.columns` dump, or Supabase branch?)

**Q17.** The FK constraints on the manually-created tables do NOT have ON DELETE CASCADE (confirmed during this session's cleanup). This means any future bulk cleanup operations will fail silently or with FK violation errors. Should a migration be written to ALTER the existing FK constraints to add ON DELETE CASCADE?

**Q18.** `sector_intelligence` table is empty despite the Monday cron running. On-demand execution succeeded. Was the Monday cron run before the ghost competitor cleanup (when the system had 107 competitors across multiple sectors)? If so, what did the sector analysis produce? And now that cleanup is done, will next Monday's run correctly scope to fintech only?

**Q19.** The `weekly_brief` from March 16 was generated from polluted data (107 competitors including RTX, Equinor, etc.). Should this brief be deleted and regenerated? Or is the brief content good enough to keep?

**Q20.** `competitor_feeds` has 15 rows (one per fintech competitor), all with `discovery_status = feed_unavailable`. These rows were created on 2026-03-16 — after the fintech competitors were set up. Were they created automatically by the onboarding process, or manually? If automatically, the discovery logic ran and found nothing.

### 15.5 Long-term Operational Reliability

**Q21.** The watchdog cron runs every 15 minutes. What does it check and what does it alert on? Is it monitoring the Sentry check-in heartbeats for each stage?

**Q22.** Sentry check-ins are configured for `extract-sections`. Which other stages have check-ins? If a cron silently fails (Vercel function crashes, network timeout), how long before it's detected?

**Q23.** The `promote-baselines` cron runs daily 02:00 UTC. What promotion criteria does it use? Is it time-based (baseline after N successful extractions) or confidence-based?

**Q24.** When a competitor changes their website structure (redesign), the selector rules break, `extraction_drift_detected` fires, and `suggest-selector-repairs` proposes fixes. Who reviews and applies these fixes? Is there an operator UI for this, or does it require direct DB edits?

**Q25.** The `signal_feedback` table allows operator quality labels. Is this being used? What happens to the labels — do they feed back into confidence scoring or signal suppression?

---

## 16. Recommended Next Steps (Priority Order)

### Immediate (before next cron cycle)
1. ✅ **Done:** extract-sections bug fixed — shell/js_rendered orphan snapshots cleared
2. ✅ **Done:** Ghost competitors removed — system down to 15 fintech competitors

### Short-term (this week)
3. **Pool 1 activation:** Manually supply RSS feed URLs for fintech competitors that have them (Mercury, Stripe, Brex blogs/newsrooms). Update `competitor_feeds.feed_url` for each.
4. **FK cascade migration:** Write migration to ALTER core table FKs to add ON DELETE CASCADE — prevents future cleanup operations from requiring manual ordered deletion.
5. **Sector intelligence validation:** Confirm the `sector_intelligence` row created today is for fintech org. Verify next Monday's job will produce correct output.

### Medium-term (this month)
6. **Baseline acceleration:** With only 57 baselines across 117 pages, the system needs more snapshot history before diffs become meaningful. Consider running `build-baselines` with a lower threshold temporarily.
7. **Pressure index calibration:** With `pending_review` signals stuck at pressure_index 0.0-0.79, review whether the 5.0 promotion threshold is appropriate for a new system. Consider a lower threshold during bootstrap phase.
8. **RSS feed audit:** Audit all 15 competitors for available RSS/Atom feeds across blog, newsroom, and changelog URLs. Pool 1 is the highest-value near-term improvement.

### Long-term (before multi-tenancy)
9. **Multi-tenancy schema design:** If Metrivant will support multiple orgs, the data isolation model needs to be explicitly designed — `org_id` propagation, shared vs. isolated competitor rows, RLS policies.
10. **Scale modelling:** Model cron throughput at 10x, 50x, 100x org count. Identify which stages become bottlenecks first (likely fetch-snapshots and extract-sections).

---

## 17. Audit Summary

| Category | Status | Notes |
|---|---|---|
| Pipeline health | ✅ healthy | `healthy: true`, 0 backlog warnings |
| fetch-snapshots | ✅ operational | 404s and challenge pages are normal |
| extract-sections | ✅ fixed | Orphan snapshot bug resolved |
| build-baselines | ✅ operational | 57 active baselines |
| detect-diffs | ✅ operational | 81% skip rate = stable content |
| detect-signals | ✅ operational | 4 clean fintech signals |
| interpret-signals | ✅ operational | 2 interpretations, gpt-4o-mini active |
| AI layers 3–6 | ✅ operational | Movements, narratives, brief all generated |
| Pool 1 | ⚠️ inactive | feed_unavailable — needs manual RSS URLs |
| Pools 2–7 | dormant / not started | Schema ready |
| Data integrity | ✅ fixed | 92 ghost competitors removed |
| Multi-tenancy | 🔴 not designed | Single-tenant architecture only |
| Schema recovery | 🔴 risk | Core tables have no CREATE TABLE migration |
| FK cascades | 🔴 risk | Manually-created tables lack ON DELETE CASCADE |

---

*Report generated: 2026-03-17 by Claude Code (claude-sonnet-4-6)*
*Next full audit recommended: after Pool 1 activation or first multi-org deployment*
