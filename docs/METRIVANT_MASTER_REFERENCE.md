METRIVANT — MASTER SYSTEM REFERENCE
Version: v4.4 (backend hardening — SSRF, fail-closed auth, hallucination gating, pool visibility, stale-content, circuit breaker, quarantine, baseline suppression)
Last updated: 2026-03-21

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
4. CRON SCHEDULE
================================================

── Runtime (vercel.json — metrivant-runtime) ──────────────────────────────────
── 50 cron entries total (verified against vercel.json 2026-03-21) ──

Fetch cadence:
  :00,:30  fetch-snapshots?page_class=ambient     (blog, careers)
  :02      fetch-snapshots?page_class=high_value  (pricing, changelog, newsroom) — every hour
  :04      fetch-snapshots?page_class=standard    (homepage, features) — every 3h

Pool ingestion (all pools active — migrations 056-060 applied 2026-03-19):
  :10      ingest-feeds              (newsroom)
  :11      ingest-careers
  :14      ingest-investor-feeds
  :29      ingest-product-feeds
  :32      ingest-procurement-feeds
  :37      ingest-media-feeds
  :43      ingest-regulatory-feeds

Pool promotion:
  :12      promote-feed-signals      (newsroom)
  :13      promote-careers-signals
  :16      promote-investor-signals
  :31      promote-product-signals
  :34      promote-procurement-signals
  :40      promote-media-signals
  :46      promote-regulatory-signals

Processing pipeline (every 30 min):
  :15,:45  extract-sections
  :17,:47  build-baselines
  :19,:49  detect-diffs
  :21,:51  detect-signals
  :23,:53  detect-ambient-activity
  :25,:55  update-pressure-index

Interpretation + movements + AI synthesis (every 60 min):
  :28,:58  interpret-signals          (twice hourly — 15 signals/batch)
  :30      synthesize-movement-narratives
  :45      generate-radar-narratives
  :50      update-signal-velocity
  :55      detect-movements

AI quality validation (every 60 min):
  :35      validate-interpretations   (GPT-4o-mini hallucination check — advisory only, does NOT gate output)
  :42      validate-movements         (GPT-4o-mini movement grounding check — advisory only)

Self-healing + self-improving (various cadences):
  :50      attribute-pool-contexts    (hourly)
  :50      retry-failed-stages        (hourly — re-invokes failed stages, max 3/run)
  */15     watchdog                   (every 15 min — freshness check)

Weekly (Mon/Wed/Fri or Sunday):
  Mon,Wed,Fri 07:00  generate-sector-intelligence
  Sun 03:30  calibrate-weights
  Sun 06:00  expand-coverage
  Sun 06:00  check-feed-health
  Sun 06:30  repair-feeds
  Sun 07:00  backfill-feeds
  Sun 07:00  learn-noise-patterns
  Sun 08:00  suggest-competitors

Daily:
  02:00  promote-baselines
  03:00  retention
  04:00  suggest-selector-repairs
  05:00  heal-coverage
  05:30  resolve-coverage
  06:30  detect-stale-competitors
  22:30  reconcile-pool-events
  22:45  detect-pool-sequences

── Frontend (radar-ui/vercel.json — metrivant-ui) ────────────────────────────

  Mon 10:00  generate-brief         ← radar-ui surface only (runtime stub is disabled)
  Hourly :00 check-signals
  Every 6h   update-momentum
  Daily 08:00 strategic-analysis
  Daily 09:00 update-positioning

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
  signal_hash = sha256(competitor_id:signal_type:section_type:diff_id)[:32]
  Anchored to the specific diff — not a daily bucket.
  Same-day distinct events each produce independent signals (e.g., morning price change + evening rollback).

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
Pool signal visibility (v4.4): signals with monitored_page_id=null are loaded
  separately by competitor_id and merged into signalWeightByCompetitor.

When pressure_index >= 5.0:
  → promotes pending_review signals → pending
  → those signals are interpreted by OpenAI on next interpret-signals run

-- Stage 8: Interpretation (interpret-signals) --

1. reset_stuck_signals(240min)  — re-queues abandoned in_progress (4h threshold)
2. fail_exhausted_signals(12)   — marks over-retried as failed (MAX_RETRIES=12, 6h survival window)
3. re-queue stale prompt versions (bounded to 20/cycle)
4. claim_pending_signals(15)    — FOR UPDATE SKIP LOCKED (atomic, BATCH_SIZE=15)
5. Relevance classification via gpt-4o-mini (parallel, best-effort):
   - low relevance → skip interpretation, mark interpreted (save cost)
6. For each claimed signal (CONCURRENCY=4, wall_clock_guard=25s):
   - circuit breaker: 3 consecutive AI failures → skip remaining, release to pending (v4.4)
   - skip if previous_excerpt === current_excerpt (noise suppression)
   - model routing: gpt-4o for high_value pages / conf >= 0.75, gpt-4o-mini otherwise
   - build prompt with competitor context + operator feedback history
   - call OpenAI (temperature=0, seed=42, json_object, timeout=20s) (v4.4)
   - quality guard: reject generic boilerplate, min 20-char summary
   - upsert interpretation, mark signal interpreted
   - fire-and-forget: update competitor_contexts
   - reset circuit breaker counter on success

Signal status flow: pending → in_progress → interpreted | failed
PROMPT_VERSION = "v1" — bump to re-interpret all signals on next cycle.

Hardening (v4.4):
  - OpenAI client timeout: 20s (within Vercel 30s function timeout)
  - Circuit breaker: 3 consecutive failures → release remaining signals to pending (no retry_count increment)
  - MAX_RETRIES=12 (6h survival at 30min cadence, up from 5/2.5h)
  - Hallucination gating: generate-radar-narratives and synthesize-movement-narratives now
    filter interpretations with validation_status='hallucinated' (v4.4)
  RESIDUAL: validate-interpretations runs at :35; narratives at :45. A ~10-minute timing gap
    exists where a new interpretation may be consumed before validation. In practice, most
    interpretations from :28 are validated by :35 before the :45 narrative run.

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
8. SCHEMA — KEY ADDITIONS (Migrations 008–017)
================================================

-- Migrations 008–012 (intelligence cadence + precision tuning) --
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

-- Migrations 013–017 (reference pipeline, constraint hardening, billing) --
signals.competitor_id                    uuid FK → competitors.id (migration 015)
                                         Backfilled via monitored_pages join.
                                         Indexed on (competitor_id, detected_at DESC) WHERE interpreted=true.

signals UNIQUE constraint:               signals_section_diff_signal_type_unique
                                         ON (section_diff_id, signal_type)
                                         Required by detect-signals ON CONFLICT.
                                         (migration 015)

signals status check constraint:         signals_status_check
                                         IN ('pending','pending_review','in_progress','interpreted','failed')
                                         (migration 016 — replaces stale chk_signals_status)

page_sections section_type constraint:   chk_section_type_page_sections
                                         Includes 'headline' (h1/h2 extraction)
                                         (migration 017)

extraction_rules section_type constraint: chk_section_type
                                         Includes 'headline'
                                         (migration 017)

section_diffs UNIQUE constraint:         section_diffs_page_type_previous_unique
                                         ON (monitored_page_id, section_type, previous_section_id)
                                         Required by detect-diffs ON CONFLICT.
                                         (migration 017)

snapshots.fetch_quality                  text CHECK IN ('full','shell') DEFAULT 'full'
                                         'shell' = bot wall / JS-rendered page (<3 text elements)
                                         (migration 017)

subscriptions table (UI Supabase):       org_id FK → organizations.id
                                         stripe_customer_id, stripe_subscription_id,
                                         status, plan, current_period_end
                                         Written by Stripe webhook on checkout.session.completed

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
  1. Collects tracked website_urls before deletion
  2. Deletes all tracked_competitors for the org
  3. Sets competitors.active = false on matching pipeline entries (service client)
     → radar clears immediately; no waiting for pipeline housekeeping
  4. Resets organizations.sector = 'custom'
  5. Returns { ok: true, removed: N }

Pipeline re-activation:
  onboard-competitor re-sets active=true when a competitor URL is re-onboarded
  after a clean slate. The upsert-on-conflict path now includes the re-activation.

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
16. USER PLAN STRUCTURE + BILLING
================================================

| Plan    | Competitors | Signal history | Alerts         |
|---------|-------------|----------------|----------------|
| Analyst | 10          | 30 days        | Weekly digest  |
| Pro     | 25          | 90 days        | Real-time      |

Legacy: plan = "starter" → treated as "analyst" everywhere.

Plan enforcement (fully implemented):
  - discover/track: enforces limit before insert (403 + upgrade_url on breach)
  - app/app/page.tsx: slices radar feed to planLimit (Pro=25, Analyst=10) after
    plan resolution — pipeline may have more active competitors but UI caps display.
  - radar-feed: returns all active pipeline competitors (no org filter); UI applies limit.

Stripe (fully integrated):
  - Checkout sessions: lib/stripe.ts (STRIPE_SECRET_KEY trimmed of whitespace)
  - Webhook: /api/stripe/webhook (processes checkout.session.completed,
    customer.subscription.updated, invoice.payment_failed)
  - Alias: /api/stripe-webhook → re-exports POST (Stripe dashboard points here)
  - On successful checkout: writes subscriptions row + sets user_metadata.plan
  - Subscriptions table: org_id, stripe_customer_id, stripe_subscription_id,
    status IN ('active','canceled_active','past_due','canceled'), plan, current_period_end

Plan resolution logic (app/app/page.tsx — force-dynamic):
  Priority 1: user_metadata.plan = "analyst"|"pro" → hasActiveSub=true, gate unlocked
              (Stripe webhook writes this; reliable even if subscriptions row is missing)
  Priority 2: subscriptions table → status: active|canceled_active|past_due
  Priority 3: time-based trial (3 days from user.created_at)

TrialLockScreen:
  Shown only when trialExpired=true AND hasActiveSub=false.
  SyncSubscription component fires on mount: searches Stripe by email,
  writes missing subscription row, router.refresh() if found.

Billing page (/app/billing):
  Subscribed users: shows SubscribedStatusSurface (plan name, renewal date,
                    subscription achievements, billing portal link)
  Unsubscribed:     shows upgrade cards + Stripe checkout CTAs
  SyncOnSuccess:    mounts when ?checkout=success and not yet subscribed,
                    auto-syncs subscription from Stripe, then refreshes

Sync endpoint: POST /api/stripe/sync-subscription
  Auth-gated. Searches Stripe by email if no stripe_customer_id.
  Upserts subscription row + sets user_metadata.plan.

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

Schema export (DISASTER RECOVERY — must be done manually):
  Core pipeline tables have no CREATE TABLE migration (see migration 000 comment).
  To create a disaster-recovery schema backup:
    1. Connect to production Supabase via psql or Supabase SQL Editor
    2. Run: pg_dump --schema-only --no-owner --no-privileges > schema_export_YYYY-MM-DD.sql
       (Or from Supabase dashboard: Settings → Database → Download schema)
    3. Save as: migrations/000_full_schema_export_YYYY-MM-DD.sql
    4. Commit to version control
  Recommended: run monthly or after any significant schema change.

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

================================================
26. PENDING SQL MIGRATIONS
================================================

Apply in Supabase SQL Editor (service role). Check migration file before running —
all migrations in /migrations/ are idempotent (DROP IF EXISTS before ADD).

Applied:
  ✅ 015_signals_competitor_id_and_radar_feed_view.sql
  ✅ 016_fix_signals_status_constraint.sql

Needs verification / apply if not yet done:
  ⬜ 017_fetch_quality_and_constraint_hardening.sql
     - Adds snapshots.fetch_quality column (removes 42703 fallback in fetch-snapshots.ts)
     - Fixes section_type constraints (page_sections + extraction_rules)
     - Adds section_diffs unique constraint (required by detect-diffs ON CONFLICT)
     - UUID-safe dedup using ctid (not MIN(id))

Note: migration 014 was superseded by 017. If 014 was already applied, 017 is still
safe to run (all steps are DROP IF EXISTS / ADD IF NOT EXISTS).

-- Migrations 026–028 (observability, feedback, retention) --
pipeline_events                    observability log for all pipeline stages; 90d retention (lib/pipeline-metrics.ts)
signal_feedback                    operator quality labels per signal (verdict, noise_category); unique per signal_id
retention functions                4 idempotent Postgres RPC functions: retention_null_raw_html,
                                   retention_delete_sections, retention_delete_diffs, retention_delete_pipeline_events

-- Migrations 030–035 (AI Intelligence Stack) --
signals.relevance_level            gpt-4o-mini pre-classification (high|medium|low); low skips interpretation
signals.relevance_rationale        one-sentence rationale from relevance classifier
strategic_movements (032):         movement_summary, strategic_implication, confidence_level, confidence_reason, narrative_generated_at
selector_repair_suggestions (031): AI-proposed CSS selector fixes; operator review only; never auto-applied
radar_narratives (033):            append-only per-competitor activity narratives; joined by radar-feed Step 7
sector_intelligence (034):         weekly cross-competitor GPT-4o analysis per org; sector_trends + divergences JSONB
weekly_briefs (035):               sector_summary, movements JSONB, activity JSONB, brief_markdown columns

-- Migrations 036–044 --
radar_positions (036):             SVG node trail per org; 28d retention
monitored_pages.health_state (037): per-page observability (healthy|blocked|challenge|degraded|baseline_maturing|unresolved)
pool_events + competitor_feeds (038): newsroom pool — append-only ingestion log + feed config per competitor
pool_events extensions (039–043):  careers, investor, product, procurement, regulatory pools (schema + code complete)
media_observations + sector_narratives (044): media pool — 30d observations + permanent narrative clusters
signals.source_type (038):         'page_diff' | 'feed_event' provenance tracking
signals extended types (038–043):  feed_press_release, feed_newsroom_post, hiring_spike, new_function, new_region,
                                   role_cluster, earnings_release, acquisition, and others

Signal hash (v4.1):
  signal_hash = sha256(competitor_id:signal_type:section_type:diff_id)[:32]
  Anchored to the diff — NOT a calendar-day bucket.
  The code in detect-signals.ts is authoritative.

================================================
27. KEY SENTRY OBSERVABILITY SIGNALS (v4.2)
================================================

Expected warnings (designed behavior, not bugs):
  fetch_shell_detected        fetch-snapshots  bot wall / JS shell detected (<3 text elements)
  extraction_drift_detected   extract-sections  section count >60% deviation from 5-snapshot avg
  radar_feed_all_zero         radar-feed       all competitors have momentum_score=0 (pipeline warming up)
  suppression_anomaly         detect-signals   competitor ≥5 diffs, ≥98% suppressed

Pipeline errors (should be zero after migrations applied):
  chk_section_type_page_sections  extract-sections  → fixed by migration 017
  chk_section_type (extraction_rules)  onboard-competitor → fixed by migration 017
  section_diffs ON CONFLICT 42P10   detect-diffs   → fixed by migration 017
  competitor_id column not found    detect-signals  → fixed by migration 015

Expected failures silenced in fetch-snapshots (isExpectedFailure):
  "Fetch failed: ..."     any HTTP error from competitor site (4xx, 5xx including 502)
  "This operation was aborted"   timeout
  "redirect count exceeded"      redirect loop
  "HTML exceeds size limit"      page > 1MB
  TypeError: fetch failed        DNS/connection failure
  23505                          concurrent run duplicate insert race

================================================
28. AI INTELLIGENCE LAYERS
================================================

The system has 6 distinct AI processing layers. All are GPT-based; none are speculative.

Layer 1 — Signal Relevance Classification
  Stage:  runs within detect-signals (or classify-signal-relevance)
  Model:  gpt-4o-mini
  Output: signals.relevance_level (high|medium|low), signals.relevance_rationale
  Gate:   relevance_level='low' → signal skips Layer 2 (cost control)

Layer 2 — Signal Interpretation
  Stage:  interpret-signals (:28 hourly)
  Model:  gpt-4o-mini (temperature=0, seed=42, json_object)
  Input:  pending signals (confidence >= 0.65 OR promoted by pressure_index >= 5.0)
  Output: interpretations table; signal status → interpreted

Layer 3 — Movement Synthesis
  Stage:  synthesize-movement-narratives (:30 hourly)
  Model:  gpt-4o
  Input:  strategic_movements WHERE movement_summary IS NULL
  Output: strategic_movements.movement_summary, strategic_implication, confidence_level, confidence_reason
  Fallback: deterministic summary on LLM failure

Layer 4 — Radar Narrative Generation
  Stage:  generate-radar-narratives (:45 hourly)
  Model:  gpt-4o-mini
  Triggers: new movement, ≥2 signals in 7d since last narrative, pressure +1.5, high_value override
  Rate limit: 12h per competitor (bypassed by high_value trigger)
  Output: radar_narratives (append-only, max 5 evidence signals per narrative)

Layer 5 — Sector Intelligence
  Stage:  generate-sector-intelligence (Mon 07:00 UTC)
  Model:  gpt-4o
  Input:  all tracked competitor signals (30d window), section-pivoted by type
  Output: sector_intelligence per org (sector_trends[], divergences[], summary)

Layer 6 — Weekly Brief Generation
  Stage:  generate-brief (Mon 10:00 UTC) — radar-ui surface only
  Model:  gpt-4o (temperature=0.25, max_tokens=1400)
  Input:  sector_intelligence.summary + strategic_movements.movement_summary + radar_narratives
          + sector_narratives (Pool 7 — optional; currently empty until media pool activates)
  Output: weekly_briefs (BriefContent JSON + brief_markdown); email via Resend
  Surface note: Implemented in radar-ui/app/api/generate-brief/route.ts.
                Runtime api/generate-brief.ts is a DISABLED STUB ({ok:true, disabled:true}).

================================================
28b. AI QUALITY VALIDATION LAYERS (v4.4 — hardened with gating)
================================================

Two post-hoc validation crons check AI-generated content for grounding in evidence.
Both are GPT-4o-mini-based (cheaper model validates more expensive model output).

Layer V1 — Interpretation Validation (validate-interpretations, :35 hourly)
  Input:   interpretations WHERE validation_status IS NULL
  Check:   Does the summary/strategic_implication follow logically from old_content/new_content?
  Output:  interpretations.validation_status = 'valid' | 'weak' | 'hallucinated'
  Action on hallucinated:
    - Confidence penalty: signal.confidence_score -= 0.15 (min 0.20)
    - Sentry warning: interpretation_hallucinated
  Downstream gating (v4.4):
    - generate-radar-narratives: filters interpretations with validation_status='hallucinated'
      from summaryBySignalId and excludes their signal IDs from signalsWithMeta
    - synthesize-movement-narratives: skips hallucinated rows when building interpMap
  RESIDUAL timing gap:
    - validate-interpretations runs at :35; generate-radar-narratives runs at :45.
      Interpretations created at :28 are usually validated by :35 before the :45 run.
      But interpretations created at :58 won't be validated until the next :35 run,
      by which time the :45 narrative run has already passed. Worst case: ~50-minute
      window where a new interpretation may be used before validation.

Layer V2 — Movement Validation (validate-movements, :42 hourly)
  Input:   strategic_movements WHERE validation_status IS NULL AND generation_reason IN ('ai', NULL)
  Check:   Does the movement_summary follow from supporting signal summaries?
  Output:  strategic_movements.validation_status = 'valid' | 'weak' | 'hallucinated'
  Action on hallucinated:
    - Downgrade confidence_level: high → medium
    - Sentry warning: movement_hallucinated
  Note: movement validation does not gate movements from radar-feed (movements are
  already displayed; gating would require a UI change). The confidence downgrade is
  the mitigation — low-confidence movements contribute less to momentum_score.

================================================
28c. SELF-IMPROVING PIPELINE SYSTEMS (added v4.3)
================================================

1. Noise Pattern Learning (learn-noise-patterns, weekly Sun 07:00)
   Input:  signal_feedback verdicts grouped by (section_type, competitor_id, signal_type)
   Rule:   noise_rate >= 80% over >= 5 samples → create suppression rule
   Output: noise_suppression_rules (checked by detect-signals before signal creation)
   Effect: operator feedback compounds permanently — false positive patterns auto-suppress

2. Confidence Calibration (calibrate-weights, weekly Sun 03:30)
   Input:  signal_feedback verdicts grouped by section_type
   Output: calibration_reports.section_stats (adjusted_weight per section_type)
   Effect: detect-signals loads latest calibration; poorly-performing section types
           get reduced base weight (min 0.60× multiplier, max 1.15×)
   Also:   confidence_calibration table (feedback-driven multipliers, applied on top)

3. Velocity Dampening (inline in detect-signals)
   Input:  14-day signal history per competitor
   Rule:   signals-in-this-run > 5× daily average → suppress excess (absolute cap: 15)
   Effect: website redesigns don't flood the pipeline; dampener resets each run

4. Cross-Pool Deduplication (inline in promote-*-signals)
   Input:  recent signals for same competitor within 48h window
   Rules:  Jaccard word similarity >= 0.55 OR same signal_type within 6h → skip
   Effect: prevents same event from creating duplicate signals through different pools

================================================
28d. SECURITY POSTURE (v4.4 — hardened)
================================================

Authentication:
  - Cron endpoints: CRON_SECRET Bearer token (timing-safe comparison)
  - Fail-closed in production (v4.4): if CRON_SECRET is unset or empty string,
    verifyCronSecret returns 503 when VERCEL_ENV=production or NODE_ENV=production.
    Local development (non-production) still allows unauthenticated access.
    Enforcement: lib/withCronAuth.ts:27-36

SSRF:
  - Shared guard: lib/url-safety.ts — isPrivateUrl() blocks localhost, 127.*, 10.*,
    192.168.*, 172.16-31.*, 169.254.169.254, 0.0.0.0, ::1, [::1], .local,
    non-http protocols, unparseable URLs.
  - Runtime fetch-snapshots: isPrivateUrl(url) called before fetchWithClassification (v4.4)
  - Runtime onboard-competitor: isPrivateUrl(baseUrl) called before discovery/validation (v4.4)
  - Runtime url-validator: isPrivateUrl(url) called before fetch() (v4.4)
  - UI onboard-competitor: existing inline SSRF check (unchanged)
  RESIDUAL: DNS rebinding attacks not covered (hostname resolves to public at check time,
    private at fetch time). Requires DNS-level pinning — out of scope at current stage.

Rate Limiting:
  - In-process token bucket (lib/rate-limit.ts) — 60 req/min per IP
  - KNOWN LIMITATION: resets on cold start, not shared across instances.
    Provides burst protection only. Vercel edge firewall is the real protection layer.

RLS:
  - interpretations: RLS enabled (migration 051)
  - Security Definer views: SELECT revoked from anon/authenticated (migration 051)
  - Runtime uses service-role client (bypasses RLS by design)

Service-Role Client:
  - Single shared instance in lib/supabase.ts
  - Used by all runtime API handlers (not exposed to client)

Stripe:
  - Webhook signature verification via constructEvent with raw body

Pool signal visibility (v4.4 — resolved):
  - update-pressure-index and radar-feed now load pool signals (monitored_page_id IS NULL)
    via separate competitor_id-based queries and merge into aggregation maps.
  - Pool pending signals are also visible in the pending count.

================================================
29. POOL SYSTEM — ADDITIVE SIGNAL ARCHITECTURE
================================================

Pools are additive signal sources running parallel to the page-diff pipeline.
Feed events flow: pool_events → promote-feed-signals → signals → existing pipeline.

Tables:   pool_events (append-only event log), competitor_feeds (feed config per competitor per pool)
Schema:   migration 038 (base), 039–043 (per-pool extensions)
Provenance: signals.source_type = 'feed_event' (vs 'page_diff' for web monitoring)
Dedup:    signal_hash is primary dedup key for feed signals

Pool 1 — Newsroom (ACTIVE)
  Migration:  038_pool_events_and_feeds.sql
  Ingest:     api/ingest-feeds.ts — scheduled :10 hourly (vercel.json)
  Promote:    api/promote-feed-signals.ts — scheduled :12 hourly
  Signal types: feed_press_release, feed_newsroom_post
  Status:     active and running

Pool 2 — Careers (ACTIVE — migrations 056-060 applied 2026-03-19)
  Migration:  039_careers_pool.sql
  Ingest:     api/ingest-careers.ts — :11 hourly (vercel.json)
  Promote:    api/promote-careers-signals.ts — :13 hourly (vercel.json)
  Signal types: hiring_spike, new_function, new_region, role_cluster
  Feeds:      11/15 fintech competitors seeded (Greenhouse/Lever/Ashby ATS APIs)
  Status:     active — signal production live

Pool 3 — Investor (ACTIVE — migrations 056-060 applied 2026-03-19)
  Migration:  040_investor_pool.sql
  Ingest:     api/ingest-investor-feeds.ts — :14 hourly (vercel.json)
  Promote:    api/promote-investor-signals.ts — :16 hourly (vercel.json)
  Signal types: earnings_release, acquisition, divestiture, guidance_update, major_contract,
                capital_raise, strategic_investment, partnership, investor_presentation
  Feeds:      3/15 fintech competitors seeded (Affirm, Marqeta, Robinhood — SEC EDGAR 8-K Atom)
  Status:     active — signal production live

Pool 4 — Product (ACTIVE — migrations 056-060 applied 2026-03-19)
  Migration:  041_product_pool.sql
  Ingest:     api/ingest-product-feeds.ts — :29 hourly (vercel.json)
  Promote:    api/promote-product-signals.ts — :31 hourly (vercel.json)
  Feeds:      4/15 fintech competitors seeded (Stripe, Plaid, Robinhood, Mercury — blog RSS)
  Status:     active — signal production live

Pool 5 — Procurement (ACTIVE — NO FEEDS)
  Migration:  042_procurement_pool.sql
  Ingest:     api/ingest-procurement-feeds.ts — :32 hourly (vercel.json)
  Promote:    api/promote-procurement-signals.ts — :34 hourly (vercel.json)
  Feeds:      0/15 — fintech B2B sector has no procurement announcement feeds
  Status:     active; no feeds to ingest (handler runs but finds 0 feeds)

Pool 6 — Regulatory (ACTIVE — migrations 056-060 applied 2026-03-19)
  Migration:  043_regulatory_pool.sql
  Ingest:     api/ingest-regulatory-feeds.ts — :43 hourly (vercel.json)
  Promote:    api/promote-regulatory-signals.ts — :46 hourly (vercel.json)
  Feeds:      3/15 fintech competitors seeded (Affirm, Marqeta, Robinhood — SEC EDGAR 10-K Atom)
  Status:     active — signal production live

Pool 7 — Media (SCHEMA COMPLETE, INGESTION NOT IMPLEMENTED)
  Migration:  044_media_pool.sql
  Tables:     media_observations (30d retention), sector_narratives (permanent)
  Data flow:  media RSS → media_observations → cluster detection → sector_narratives
              → sector_intelligence context → weekly brief "Market Context"
  Ingest:     api/ingest-media-feeds.ts — exists, ingestion logic not yet implemented
  Status:     schema complete; sector_narratives table is empty until implemented
  Impact:     weekly briefs query sector_narratives as optional input and run without it;
              briefs omit Market Context section until Pool 7 is activated
