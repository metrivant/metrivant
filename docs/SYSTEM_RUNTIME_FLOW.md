SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md

METRIVANT — SYSTEM RUNTIME FLOW
Version: v2.0 (intelligence cadence + precision tuning)

------------------------------------------------
1. Runtime Stack
------------------------------------------------

GitHub
→ code

Vercel (two projects)
→ metrivant-runtime  : pipeline cron jobs
→ metrivant-ui       : Next.js 15 app (radar-ui/)

Supabase
→ system state machine

OpenAI (gpt-4o-mini)
→ signal interpretation only

Sentry
→ monitoring + check-ins per cron stage

------------------------------------------------
2. Cron Schedule (vercel.json — metrivant-runtime)
------------------------------------------------

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

------------------------------------------------
3. Page Classification (monitored_pages.page_class)
------------------------------------------------

high_value  pricing, changelog, newsroom
            → fetched every 60 min
            → full signal pipeline

standard    homepage, features
            → fetched every 3 hours
            → full signal pipeline

ambient     blog, careers
            → fetched every 30 min
            → creates activity_events ONLY (no signals)
            → feeds pressure_index and UI ticker

------------------------------------------------
4. Fetch Runtime (fetch-snapshots)
------------------------------------------------

Reads:   monitored_pages WHERE active=true AND page_class=:param
Writes:  snapshots (raw_html, content_hash, fetched_at)

Sentry monitor slug: fetch-snapshots-{ambient|high-value|standard}

------------------------------------------------
5. Extraction Runtime (extract-sections)
------------------------------------------------

Reads:   snapshots WHERE sections_extracted=false
         extraction_rules for those pages

Writes:  page_sections (section_text, section_hash, validation_status)

cleanText() pipeline:
  NFC normalize → Unicode whitespace collapse → smart quote normalize
  → em-dash normalize → whitespace collapse

extractSectionText() noise stripping (broad selectors only):
  Removes nav, footer, aside, script, style, cookie banners, chat widgets
  before extracting text. Narrow selectors (h1, h2) are untouched.

Updates: snapshots.sections_extracted = true

------------------------------------------------
6. Baseline Runtime (build-baselines)
------------------------------------------------

Idempotent INSERT-only. Never updates existing baselines.
Baseline = FIRST valid section ever observed for (page, section_type).
All future diffs are measured against this anchor.

------------------------------------------------
7. Diff Runtime (detect-diffs)
------------------------------------------------

Batch architecture (eliminates N+1):
  1. Load latest valid sections (limit 500)
  2. Load all baselines for those pages (1 bulk query)
  3. Pre-filter to changed sections only
  4. Batch-load existing diffs for changed pages (1 bulk query)
  5. Batch-load section hashes for existing diff current_section_ids (1 bulk query)
  6. Process with Maps — zero per-row queries

Confirmed on first observation (observation_count >= 1).

------------------------------------------------
8. Signal Detection Runtime (detect-signals)
------------------------------------------------

Input: section_diffs WHERE confirmed=true AND signal_detected=false
       AND is_noise=false
       AND monitored_pages.page_class != 'ambient'

Whitespace identity check:
  prev.replace(/\s+/g,"") === curr.replace(/\s+/g,"")
  → mark diff is_noise=true, noise_reason='whitespace_only', skip signal

Confidence model:
  base = SECTION_WEIGHTS[section_type]  (0.25–0.85)
  recency_bonus = 0.05–0.15
  obs_bonus = min(0.15, (obs-1)*0.05)
  confidence = min(1.0, base + recency_bonus + obs_bonus)

Confidence gates:
  < 0.35  → suppressed (no signal)
  0.35–0.64 → status='pending_review' (held for pressure_index promotion)
  >= 0.65 → status='pending' (sent to OpenAI)

Deduplication:
  signal_hash = sha256(competitor_id:signal_type:YYYY-MM-DD)[:32]
  One signal per (competitor, type) per calendar day

Smart excerpts:
  Finds divergence point between old/new text, backs up to word boundary,
  extracts 200-char window centered on the change

------------------------------------------------
9. Ambient Activity Runtime (detect-ambient-activity)
------------------------------------------------

Input:  confirmed diffs from ambient pages
Output: activity_events (NOT signals, NOT interpreted by OpenAI)
        Feeds: UI ticker, radar node activity, pressure_index

Prunes activity_events older than 30 days each run.

------------------------------------------------
10. Pressure Index Runtime (update-pressure-index)
------------------------------------------------

Formula:
  pressure_index = Σ(severity_weight × confidence × exp(-age_days × 0.2))
                 + activity_events_48h × 0.15
  capped at 10.0

Signal window: 7 days
Activity window: 48 hours

Side effect: when pressure_index >= 5.0
  → promotes pending_review signals → pending
  → those signals are interpreted by OpenAI on next interpret-signals run

------------------------------------------------
11. Interpretation Runtime (interpret-signals)
------------------------------------------------

1. reset_stuck_signals(30min)   — re-queues abandoned in_progress
2. fail_exhausted_signals(5)    — marks over-retried as failed
3. re-queue stale prompt versions (bounded to 20/cycle)
4. claim_pending_signals(5)     — FOR UPDATE SKIP LOCKED (atomic)
5. For each claimed signal:
   - skip if previous_excerpt === current_excerpt (noise suppression)
   - build prompt: competitor, signal_type, severity, page_type, page_url, excerpts
   - call OpenAI gpt-4o-mini (temperature=0, seed=42, json_object)
   - upsert interpretation
   - mark signal interpreted

PROMPT_VERSION = "v1" — bump to re-interpret all signals on next cycle.

------------------------------------------------
12. Movement Detection Runtime (detect-movements)
------------------------------------------------

Window: 14 days (not 30 — active clusters only)
Filter: interpreted=true AND confidence_score >= 0.40
Min signals: 2 required to declare a movement

Confidence formula:
  avgConf * 0.65 + min(signalCount, 6) * 0.06
  capped at 0.95

Upserts on (competitor_id, movement_type) — no duplicate rows across runs.

------------------------------------------------
13. Manual Pipeline Trigger (curl)
------------------------------------------------

SECRET = CRON_SECRET from .env.local
BASE   = https://metrivant-runtime.vercel.app

Run 1 (establish baselines):
  curl "$BASE/api/fetch-snapshots?page_class=high_value" -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/fetch-snapshots?page_class=standard"   -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/extract-sections"                       -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/build-baselines"                        -H "Authorization: Bearer $SECRET"

Run 2 (detect and interpret, ~6s between each):
  curl "$BASE/api/detect-diffs"        -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/detect-signals"      -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/interpret-signals"   -H "Authorization: Bearer $SECRET"
  curl "$BASE/api/detect-movements"    -H "Authorization: Bearer $SECRET"

rowsClaimed=0 everywhere = no competitors onboarded yet.
Onboard via UI Discover page or POST /api/onboard-competitor.

------------------------------------------------
14. Runtime Metrics (Sentry context per stage)
------------------------------------------------

rows_claimed, rows_processed, rows_succeeded, rows_failed,
runtime_duration_ms + stage-specific counters

Sentry captureCheckIn at start (in_progress) and end (ok|error).

------------------------------------------------
15. Failure Recovery
------------------------------------------------

Serverless crashes do not corrupt state.
All tables use status columns as resumable checkpoints.
Next cron run picks up where the crash left off.
No manual intervention required for transient failures.