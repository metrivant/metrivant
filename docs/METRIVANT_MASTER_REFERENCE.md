METRIVANT — MASTER SYSTEM REFERENCE
Version: v4.1 (reliability hardening pass — operational observability)
Last updated: 2026-03-14

This document is the single authoritative reference for the Metrivant system.
It replaces: ARCHITECTURE_INDEX, MASTER_ARCHITECTURE_PLAN, SYSTEM_ARCHITECTURE,
SUPABASE_ARCHITECTURE, PIPELINE_STATE_MACHINE, SYSTEM_RUNTIME_FLOW, OPERATIONS,
PATTERN_LAYER.

================================================
1. SYSTEM IDENTITY
================================================

Metrivant is a deterministic competitive intelligence radar.
It is not a generic dashboard. It is not a noisy AI toy.
It is a precision instrument for detecting competitor movement.

Core equation:
  Code detects whether changes happened.
  AI (GPT-4o-mini) explains what the changes mean.

The market is a radar field:
  Competitors     = nodes on the radar
  Changes         = raw signals
  Signal clusters = strategic movement
  Movement trends = market strategy

Node distance from center = momentum.
A competitor near the boundary is accelerating.
A competitor at the origin is quiet.

================================================
2. SYSTEM STACK
================================================

| Layer             | Technology                              |
|-------------------|-----------------------------------------|
| Frontend          | Next.js 16.1.6 (App Router)             |
| UI runtime        | React 19.2.3                            |
| Language          | TypeScript (strict mode)                |
| Styling           | Tailwind CSS v4                         |
| Animation         | Framer Motion 12.35.2                   |
| UI deployment     | Vercel — metrivant-ui (radar-ui/) — git-connected to metrivant/metrivant |
| Pipeline runtime  | Vercel — metrivant-runtime (api/) — git-connected to metrivant/metrivant |
| Database + Auth   | Supabase (Postgres + Auth)              |
| AI interpretation | OpenAI GPT-4o-mini                      |
| Error monitoring  | Sentry (@sentry/nextjs)                 |
| Email             | Resend                                  |
| Analytics         | PostHog (manual events only)            |
| Source control    | GitHub                                  |

Production URLs:
  Runtime API: https://metrivant-runtime.vercel.app
  UI:          https://metrivant.com

================================================
3. CORE PIPELINE
================================================

competitors
→ monitored_pages        (page_class: high_value | standard | ambient)
→ snapshots
→ page_sections
→ section_baselines      (insert-only anchor — never overwrite)
→ section_diffs          (batch-loaded, no N+1 queries)
→ signals                (confidence-gated, signal_hash deduped)
→ activity_events        (ambient-only, NOT signals, NOT interpreted)
→ interpretations        (OpenAI gpt-4o-mini, pending signals only)
→ strategic_movements    (14d window, min 2 signals)
→ radar_feed
→ UI

================================================
4. CRON SCHEDULE (vercel.json — metrivant-runtime)
================================================

Three-tier fetch cadence:
  :00,:30  fetch-snapshots?page_class=ambient     (blog, careers)
  :02,:32  fetch-snapshots?page_class=high_value  (pricing, changelog, newsroom)
  :04      fetch-snapshots?page_class=standard    (homepage, features) — every 3h

Processing pipeline (every 30 min):
  :15,:45  extract-sections
  :17,:47  build-baselines
  :19,:49  detect-diffs
  :21,:51  detect-signals
  :23,:53  detect-ambient-activity
  :25,:55  update-pressure-index

Interpretation + movements (every 60 min):
  :28      interpret-signals
  :50      update-signal-velocity
  :55      detect-movements

Weekly:
  Mon 09:00  generate-brief

================================================
5. PAGE CLASSIFICATION (monitored_pages.page_class)
================================================

high_value   pricing, changelog, newsroom
             → fetched every 60 min
             → full signal pipeline
             → +0.08 page_class_bonus on confidence score

standard     homepage, features
             → fetched every 3 hours
             → full signal pipeline

ambient      blog, careers
             → fetched every 30 min
             → creates activity_events ONLY (no signals, no OpenAI)
             → feeds pressure_index and UI ticker
             → 30-day retention (pruned each run)

================================================
6. PIPELINE STAGE DETAILS
================================================

-- Stage 1: Snapshot --

Table: snapshots
Initial state:  sections_extracted = false, status = 'fetched'
After extract:  sections_extracted = true, sections_extracted_at = timestamp
Reads: monitored_pages WHERE active=true AND page_class=:param
Writes: snapshots (raw_html, content_hash, fetched_at)

-- Stage 2: Extraction (extract-sections) --

cleanText() pipeline:
  NFC normalize → Unicode whitespace/NBSP collapse → smart quote normalize
  → em-dash normalize → whitespace collapse

extractSectionText() — strips noise before text extraction (broad selectors only):
  Noise selectors: nav, footer, aside, script, style, noscript,
    [aria-hidden], [role=banner/navigation/complementary],
    .cookie-banner, .consent-banner, .gdpr-banner, .cc-banner,
    .chat-widget, #intercom-container, .intercom-lightweight-app,
    #hubspot-messages-iframe-container, .drift-widget, #drift-widget, #crisp-chatbox,
    .announcement-bar, .promo-bar, .notification-bar, .alert-bar,
    [data-nosnippet]
  Broad selectors where noise stripping is applied: main, body, article, #content, .content
  Narrow selectors (h1, h2) are untouched.

-- Stage 3: Baselines (build-baselines) --

Table: section_baselines
Key: (monitored_page_id, section_type)
Baseline = FIRST valid section ever observed for (page, section_type).
INSERT-only. Never updates existing baselines.
All future diffs are measured against this immutable anchor.

-- Stage 4: Diff Detection (detect-diffs) --

Batch architecture (eliminates N+1):
  1. Load latest valid sections (limit 500)
  2. Load all baselines for those pages (1 bulk query)
  3. Pre-filter to changed sections only
  4. Batch-load existing diffs for changed pages (1 bulk query)
  5. Batch-load section hashes for existing diff current_section_ids (1 bulk query)
  6. Process with Maps — zero per-row queries

Diff states: unconfirmed | confirmed | unstable
Confirmed on first observation (observation_count >= 1).

-- Stage 5: Signal Detection (detect-signals) --

Input: section_diffs WHERE confirmed=true AND signal_detected=false
       AND is_noise=false AND monitored_pages.page_class != 'ambient'

Batch architecture (eliminates N+1):
  Pre-loads all previous_section_id + current_section_id for the entire batch
  in a single .in() query before the loop. Zero per-row queries.

Noise gates (applied in order before signal creation):
  1. Whitespace-only:
     prev.replace(/\s+/g,"") === curr.replace(/\s+/g,"")
     → is_noise=true, noise_reason='whitespace_only'
  2. Dynamic-content-only (normalizeForComparison):
     Strips ISO 8601 timestamps + UTM/tracking params from both sides.
     If normalized texts are equal:
     → is_noise=true, noise_reason='dynamic_content_only'

Confidence model:
  base             = SECTION_WEIGHTS[section_type]  (0.25–0.85)
  recency_bonus    = 0.05 / 0.10 / 0.15
  obs_bonus        = min(0.15, (observations-1) * 0.05)
  page_class_bonus = 0.08 if page_class='high_value', else 0
  score            = min(1.0, base + recency_bonus + obs_bonus + page_class_bonus)

Confidence gates:
  < 0.35        → suppressed — no signal, diff marked processed
  0.35 – 0.64   → status = 'pending_review' (held until pressure_index >= 5.0 promotes)
  >= 0.65       → status = 'pending' (sent to OpenAI)

Deduplication:
  signal_hash = sha256(competitor_id:signal_type:section_type:YYYY-MM-DD)[:32]
  One signal per (competitor, section_type, signal_type) per UTC calendar day.
  Allows same signal_type from different page sections to fire independently.

Smart excerpts (buildExcerpts):
  Finds first divergence point, backs up to word boundary,
  extracts 200-char window centered on the change.

-- Stage 6: Ambient Activity (detect-ambient-activity) --

Input:  confirmed diffs from ambient pages
Output: activity_events (NOT signals, NOT OpenAI-interpreted)
        Feeds: UI ticker, radar node activity, pressure_index
Prunes activity_events older than 30 days each run.

-- Stage 7: Pressure Index (update-pressure-index) --

Formula:
  pressure_index = Σ(severity_weight × confidence × exp(-age_days × 0.2))
                 + activity_events_48h × 0.15
  capped at 10.0

Signal window: 7 days
Activity window: 48 hours

When pressure_index >= 5.0:
  → promotes pending_review signals → pending
  → those signals are interpreted by OpenAI on next interpret-signals run

-- Stage 8: Interpretation (interpret-signals) --

1. reset_stuck_signals(30min)   — re-queues abandoned in_progress
2. fail_exhausted_signals(5)    — marks over-retried as failed
3. re-queue stale prompt versions (bounded to 20/cycle)
4. claim_pending_signals(5)     — FOR UPDATE SKIP LOCKED (atomic)
5. For each claimed signal:
   - skip if previous_excerpt === current_excerpt (noise suppression)
   - build prompt: competitor, signal_type, severity, page_type, page_url, excerpts
   - call OpenAI gpt-4o-mini (temperature=0, seed=42, json_object)
   - upsert interpretation, mark signal interpreted

Signal status flow: pending → in_progress → interpreted | failed
PROMPT_VERSION = "v1" — bump to re-interpret all signals on next cycle.

-- Stage 9: Movement Detection (detect-movements) --

Table: strategic_movements
Window: 14 days (active clusters only)
Filter: interpreted=true AND confidence_score >= 0.40
Min signals: 2 required per competitor

Confidence formula:
  avgConf * 0.65 + min(signalCount, 6) * 0.06
  capped at 0.95

Upserts on (competitor_id, movement_type) — idempotent across cron cycles.

================================================
7. IDEMPOTENCY CONSTRAINTS
================================================

snapshots:           (monitored_page_id, content_hash)
page_sections:       (snapshot_id, section_type)
section_diffs:       (monitored_page_id, section_type, previous_section_id)
signals:             (section_diff_id, signal_type)
signals:             signal_hash (partial unique index — WHERE signal_hash IS NOT NULL)
strategic_movements: (competitor_id, movement_type)

All pipeline stages are safe to re-run.

================================================
8. SCHEMA — KEY ADDITIONS (Migrations 008–012)
================================================

monitored_pages.page_class               'high_value' | 'standard' | 'ambient'
monitored_pages.last_fetched_at          timestamptz
monitored_pages.consecutive_fetch_failures  integer (auto-deactivates at >= 5)

signals.confidence_score                 float 0.0–1.0
signals.signal_hash                      sha256 dedup key
signals.suppressed_at                    timestamptz (audit trail)
signals.suppressed_reason                text
signals.interpreter_confidence           float (from OpenAI, separate from score)

competitors.pressure_index               urgency scalar 0.0–10.0
competitors.last_signal_at               denormalized, kept by trigger

section_diffs.diff_size_bytes            integer

activity_events                          ambient intelligence table (30-day retention)

interpretations.prompt_hash              text (for PROMPT_VERSION gating)

Triggers:
  trg_deactivate_failing_pages     — deactivates monitored_pages when failures >= 5
  trg_sync_last_signal_at          — keeps competitors.last_signal_at current

================================================
9. SECTOR MODEL
================================================

Sectors: saas, defense, energy, cybersecurity, fintech, ai-infrastructure,
         devtools, healthcare, consumer-tech, custom

Full SectorConfig (terminology translation): saas, defense, energy
Remaining sectors: catalog + display support only, fall back to SaaS terminology

Each sector has 15 competitors in the catalog (lib/sector-catalog.ts).

Seeding strategy (getSectorRandomDefaults):
  - Priority 1–5 are always included (anchored — most important names)
  - 5 slots filled by random sampling from priority 6–15 (Fisher-Yates shuffle)
  - Provides variety across sector switches while keeping top names stable

Pipeline bridge:
  When initialize-sector seeds tracked_competitors, it ALSO calls the runtime
  onboard-competitor API for each competitor (fire-and-forget) so that
  monitored_pages and extraction_rules are created immediately.
  env vars required: RUNTIME_URL, CRON_SECRET

Custom sector:
  - No default catalog — user starts with empty slate
  - Accessible via SectorSwitcher dropdown (with separator)
  - Clean Slate button resets any sector back to Custom

================================================
10. PIPELINE OBSERVABILITY
================================================

GET /api/pipeline-status (Authorization: Bearer CRON_SECRET)

Global summary:
  lastSnapshotAt           — most recent snapshot timestamp
  pendingSnapshotBacklog   — snapshots awaiting extraction
  unconfirmedDiffBacklog   — diffs not yet confirmed
  confirmedDiffBacklog     — confirmed diffs awaiting signal detection
  pendingSignalBacklog     — signals awaiting interpretation
  failedSignals            — signals that exhausted retries

Per-competitor diagnostics:
  id, name
  monitoredPageCount       — number of active monitored pages
  lastSnapshotAt           — most recent snapshot for this competitor
  lastSignalAt             — most recent signal (denormalized from competitors table)
  pressureIndex            — current pressure_index scalar (0.0–10.0)
  sectionCount             — total page_sections across all pages
  diffCount                — total section_diffs across all pages
  signalCount              — total signals across all pages
  baselineCount            — total section_baselines across all pages
  pagesWithNoSections      — pages where sectionCount = 0 (extraction gap)
  pagesWithNoRules         — pages where no active extraction_rules exist

Derive baseline_building state:
  any page where sectionCount > 0 AND baselineCount = 0
  → baselines not yet established, pipeline will start diffing on next build-baselines run

================================================
11. COMPETITOR ONBOARDING FLOW
================================================

User flow:
  1. Select sector (onboarding or SectorSwitcher)
  2. /api/initialize-sector:
     a. Resolve/create organization
     b. Clear existing tracked_competitors
     c. Seed tracked_competitors with random defaults (top 5 anchored + 5 random)
     d. Fire-and-forget: call runtime /api/onboard-competitor for each competitor
  3. runtime/onboard-competitor:
     a. Creates competitor record (idempotent)
     b. Creates monitored_pages (homepage, pricing, changelog, blog, features, newsroom, careers)
     c. Creates extraction_rules for each page type
  4. Pipeline runs → first signals appear

Manual competitor addition:
  /api/discover/track → writes tracked_competitors
  Also requires runtime onboard-competitor call to enter pipeline.

================================================
12. CLEAN SLATE
================================================

Route: POST /api/clean-slate
Effect:
  1. Deletes all tracked_competitors for the org
  2. Resets organizations.sector = 'custom'
  3. Returns { ok: true, removed: N }

UI: CleanSlateButton in radar header (hidden on mobile)
  - Inline confirm flow (shows count of rivals to be removed)
  - Destructive styling (amber/red border, subtle)
  - On confirm: POST /api/clean-slate → router.refresh()

================================================
13. MOMENTUM MODEL
================================================

States:
  cooling       score < 1.5     color: #64748b (slate)   arrow: ↓
  stable        1.5 ≤ score < 3 color: #2EE6A6 (green)   arrow: →
  rising        3 ≤ score < 5   color: #f59e0b (amber)   arrow: ↑
  accelerating  score >= 5      color: #ef4444 (red)      arrow: ⚡

Critical alert threshold (ALL five criteria required):
  1. momentum_score >= 7
  2. signals_7d >= 3
  3. latest_movement_confidence >= 0.70
  4. latest_movement_type is present
  5. latest_movement_last_seen_at within 48 hours

At most ONE critical alert fires per radar load (highest-momentum qualifier).
Session dedup key: ${competitor_id}__${latest_movement_last_seen_at}

================================================
14. RADAR INTERFACE
================================================

Geometry:
  1000×1000 SVG viewport, CENTER = 500, OUTER_RADIUS = 420
  4 ring radii: 0.28, 0.50, 0.72, 1.0 of OUTER_RADIUS
  72 tick marks (every 5°)
  radarClip clipPath enforces instrument boundary

Node distribution: golden angle spiral — prevents clustering, max 50 nodes

Animation:
  Sonar pulse: 12-second sweep cycle (staggered 4s between 3 rings)
  Echo rings: 24-second cycle (staggered 12s), 2 rings per node
  Echo ring duration varies: accelerating = 1.5s, rising = 2.2s, other = 3.0s
  All motion is smooth, slow, premium — no jarring transitions

Alert visual model:
  Two boundary rings pulse in movement type color outside radar clip
  Alerted node: bloom ring + pulsing stroke halo
  Alert banner overlays radar bottom via AnimatePresence

Information hierarchy:
  1. Radar (who is moving, how fast)
  2. Selected competitor drawer (what movement, which signals)
  3. Evidence chain (raw diff excerpts, signal confidence, page coverage)
  4. Strategic patterns (Strategy page — cross-competitor)

Empty state: "INITIALIZING RADAR" — auto-refresh every 30s via router.refresh()

================================================
15. STRATEGIC ANALYSIS MODEL
================================================

Pattern types: feature_convergence, pricing_competition, category_expansion,
               enterprise_shift, product_bundling, market_repositioning

Rules:
  Min 2 competitors per pattern, max 5 insights per analysis
  is_major = true when competitor_count >= 3 OR confidence >= 0.82
  GPT-4o temperature 0.20

Positioning map (lib/positioning.ts):
  X: market_focus_score 0–100 (Niche → Platform)
  Y: customer_segment_score 0–100 (SMB → Enterprise)
  Significant shift threshold: > 15 points on either axis

================================================
16. USER PLAN STRUCTURE
================================================

| Plan    | Competitors | Signal history | Alerts         |
|---------|-------------|----------------|----------------|
| Analyst | 5           | 30 days        | Weekly digest  |
| Pro     | 25          | 90 days        | Real-time      |

Legacy: plan = "starter" → treated as "analyst" everywhere.
Plan enforcement: defined in product, not yet enforced at DB/API level.
Billing: informational only — no Stripe integration.

================================================
17. EMAIL SYSTEM
================================================

Provider: Resend
Senders: hello@, alerts@, briefs@ metrivant.com

Types: welcome, tracking confirmation, first signal, momentum alert,
       repositioning alert, signal alert (urgency >= 3, 120min window),
       weekly brief, strategy alert

================================================
18. ENVIRONMENT VARIABLES
================================================

Runtime (metrivant-runtime):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  OPENAI_API_KEY
  CRON_SECRET
  SENTRY_DSN

UI (radar-ui):
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  CRON_SECRET              ← required for pipeline bridge in initialize-sector
  RUNTIME_URL              ← defaults to https://metrivant-runtime.vercel.app
  OPENAI_API_KEY
  SENTRY_DSN
  NEXT_PUBLIC_POSTHOG_KEY
  RESEND_API_KEY

================================================
19. MANUAL PIPELINE TRIGGER
================================================

SECRET = CRON_SECRET from .env.local
BASE   = https://metrivant-runtime.vercel.app

Run 1 — establish baselines:
  curl "$BASE/api/fetch-snapshots?page_class=high_value" -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/fetch-snapshots?page_class=standard"   -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/extract-sections"                       -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/build-baselines"                        -H "Authorization: Bearer $SECRET"

Run 2 — detect and interpret (~6s between each):
  curl "$BASE/api/detect-diffs"        -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/detect-signals"      -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/interpret-signals"   -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/detect-movements"    -H "Authorization: Bearer $SECRET"

rowsClaimed=0 everywhere = no competitors onboarded yet.
Onboard via UI Discover page or sector selection flow.

Onboard a specific competitor manually:
  curl "$BASE/api/onboard-competitor" \
    -H "Authorization: Bearer $SECRET" \
    -H "Content-Type: application/json" \
    -d '{"name":"Acme Corp","website_url":"https://acme.com"}'

================================================
20. OPERATIONS — HEALTH CHECKS
================================================

/api/health response fields (v4.1):
  ok                                      = endpoint executed without throwing
  healthy                                 = system operating within SLA thresholds
                                            (fetch fresh + no stuck signals + no backlog warnings)
  latestFetchAt                           = timestamp of most recent snapshot
  snapshotBacklog                         = snapshots with sections_extracted=false
  diffBacklog                             = confirmed diffs with signal_detected=false
  signalBacklog                           = signals with status='pending'
  stuckSignals                            = signals in_progress older than 30 min
  failedSignals                           = signals with status='failed'
  recentSignals                           = signals detected in last 7 days
  oldestSnapshotWaitingExtractionMinutes  = age of oldest unprocessed snapshot (SLA: 240 min)
  oldestDiffWaitingSignalMinutes          = age of oldest unprocessed confirmed diff (SLA: 480 min)
  oldestSignalWaitingInterpretationMinutes= age of oldest pending signal (SLA: 240 min)
  noiseDiffRatioLast24h                   = is_noise diffs / all confirmed diffs in 24h window
                                            (diff-level noise rate — NOT the signal-stage suppression rate)
  noiseDiffs24h                           = count of is_noise=true confirmed diffs in last 24h
  totalDiffs24h                           = count of all confirmed diffs in last 24h
  pipelineBacklogWarnings[]               = active SLA breaches:
                                            "snapshot_extraction_backlog" | "diff_signal_backlog" |
                                            "signal_interpretation_backlog" | "high_suppression_ratio"

Sentry warnings emitted by health endpoint:
  pipeline_backlog_warning   stage + oldest_age_minutes + sla_minutes
  suppression_ratio_warning  suppression_ratio_24h + noise_diffs_24h + total_diffs_24h
                             (fires only when totalDiffs24h >= 10 AND noiseDiffRatioLast24h >= 0.90)

Operational observability added in v4.1 (Sentry warnings per pipeline stage):
  suppression_anomaly           detect-signals  competitor with ≥5 diffs, ≥98% suppressed
  extraction_drift_detected     extract-sections  >60% deviation in section count vs 5-snapshot avg
  baseline_instability_warning  build-baselines  >5 new baselines/page in last 7 days
  diff_stability_warning        detect-diffs    diff at MAX_OBSERVATION_COUNT (5) with no signal
  pipeline_backlog_warning      health          oldest unprocessed row per stage exceeds SLA
  suppression_ratio_warning     health          diff-level noise rate > 90% in 24h window

Extraction blackout (pages with no valid sections in 48h):
  SELECT mp.id FROM monitored_pages mp
  LEFT JOIN page_sections ps
    ON ps.monitored_page_id = mp.id AND ps.validation_status = 'valid'
    AND ps.created_at > NOW() - INTERVAL '48 hours'
  WHERE mp.active = true GROUP BY mp.id HAVING COUNT(ps.id) = 0;

Signal pipeline activity (last 7d):
  SELECT COUNT(*) FROM signals WHERE detected_at > NOW() - INTERVAL '7 days';

Interpretation backlog:
  SELECT COUNT(*) FROM signals WHERE status = 'pending';

Stuck interpretations:
  SELECT id FROM signals
  WHERE status = 'in_progress' AND updated_at < NOW() - INTERVAL '30 minutes';

Snapshot backlog:
  SELECT COUNT(*) FROM snapshots WHERE sections_extracted = false;

Diff backlog:
  SELECT COUNT(*) FROM section_diffs WHERE status = 'confirmed' AND signal_detected = false;

Fetch health:
  SELECT MAX(fetched_at) FROM snapshots;

Pressure index summary:
  SELECT name, pressure_index, last_signal_at FROM competitors ORDER BY pressure_index DESC;

Signal confidence distribution:
  SELECT signal_type, COUNT(*), AVG(confidence_score)
  FROM signals WHERE detected_at > NOW() - INTERVAL '7 days'
  GROUP BY signal_type ORDER BY COUNT(*) DESC;

================================================
21. OPERATIONS — MANUAL RECOVERY
================================================

Reset stuck signal:
  UPDATE signals SET status = 'pending' WHERE id = 'SIGNAL_ID';

Re-run extraction on a snapshot:
  UPDATE snapshots SET sections_extracted = false WHERE id = 'SNAPSHOT_ID';

Promote a diff to confirmed:
  UPDATE section_diffs SET status = 'confirmed' WHERE id = 'DIFF_ID';

Re-interpret all signals (bump PROMPT_VERSION = "v2" in interpret-signals.ts,
then on next run all signals with prompt_hash != new version are re-queued).

Database size:
  SELECT pg_size_pretty(pg_database_size(current_database()));

================================================
22. DEBUGGING ENTRY POINT
================================================

If the pipeline has no output, inspect tables in this order:
  competitors           → are there active competitors?
  monitored_pages       → do those competitors have active pages?
  snapshots             → are recent snapshots being created?
  page_sections         → are sections being extracted?
  section_baselines     → are baselines established?
  section_diffs         → are confirmed diffs building up?
  signals               → are signals gated at confidence?
  interpretations       → is OpenAI responding?
  strategic_movements   → is min 2 signals threshold met?

The first stage missing expected rows indicates the failure point.

================================================
23. DEVELOPMENT WORKFLOW (REQUIRED FOR EVERY TASK)
================================================

Phase 1 — Understand
  - Identify pipeline stage or UI surface involved
  - Identify which files own the logic and state
  - Understand contracts at risk (API shapes, DB schemas)
  - Assess blast radius

Phase 2 — Plan
  - Propose smallest safe change
  - List every file to be modified + justify each
  - Prefer extending existing patterns

Phase 3 — Implement
  - Modify only approved files
  - Preserve naming conventions and existing contracts
  - Keep TypeScript strict (npx tsc --noEmit must pass)
  - Keep styling consistent with design language
  - Keep animations subtle, smooth, purposeful

Phase 4 — Verify
  - Run npx tsc --noEmit
  - Confirm no unrelated files modified
  - Confirm no pipeline behavior changed

Phase 5 — Report
  - Files changed and why
  - Files deleted and why
  - What was simplified
  - What functionality improved
  - What risks were avoided
  - Remaining technical debt
  - Optional next step

================================================
24. NEVER DO THESE
================================================

Without explicit approval:
- rewrite large parts of the repo
- redesign the architecture
- change working backend contracts casually
- add large dependencies
- introduce queues, microservices, Kafka, background workers, or enterprise patterns
- create abstractions that reduce clarity
- add visual noise or gimmicky animation
- turn the radar into a generic feed-first SaaS dashboard
- any change to radar_feed shape or competitor-detail shape
- any new schema migration without listing exact SQL
- any change to authentication or authorization logic

================================================
25. ENGINEERING PRINCIPLES
================================================

- Simplicity over cleverness
- Determinism over magic
- Legibility over abstraction
- Small safe changes over large rewrites
- Deletion over bloat
- Calm refinement over flashy complexity
- Production-grade maintainability at all times
- Solo-operator maintainability preserved always
