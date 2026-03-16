METRIVANT — PIPELINE STATE MACHINE
Version: v2.0 (intelligence cadence + precision tuning)

------------------------------------------------
1. Pipeline Overview
------------------------------------------------

fetch (by page_class tier)
→ snapshot
→ extract section          (cleanText + DOM noise stripping)
→ validate extraction
→ baseline comparison      (insert-only, never overwrites)
→ diff detection           (batch queries — no N+1)
→ whitespace noise filter  (suppress formatting-only changes)
→ signal detection         (confidence gating + signal_hash dedup)
→ ambient activity routing (ambient diffs → activity_events, not signals)
→ pressure index update    (promotes pending_review at threshold >= 5.0)
→ signal interpretation    (OpenAI — only pending + high confidence)
→ movement detection       (14d window, min 2 signals, confidence-weighted)
→ weekly brief

------------------------------------------------
2. Snapshot Stage
------------------------------------------------

Table: snapshots

Initial state:

sections_extracted = false
status = 'fetched'

Extraction reads:

sections_extracted = false

After completion:

sections_extracted = true
sections_extracted_at = timestamp

------------------------------------------------
3. Page Section Stage
------------------------------------------------

Table: page_sections

Created during extraction.

Key fields:

section_text
section_hash
validation_status

Validation states:

valid
suspect
failed

Only valid rows enter baseline comparison.

------------------------------------------------
4. Baseline Stage
------------------------------------------------

Table: section_baselines

Key:

monitored_page_id
section_type

Baseline created after repeated identical extractions.

------------------------------------------------
5. Diff Stage
------------------------------------------------

Table: section_diffs

Possible states:

unconfirmed
confirmed
unstable

Confirmed diffs proceed to signal detection.

------------------------------------------------
6. Signal Stage
------------------------------------------------

Table: signals

Input condition:

section_diffs.status = 'confirmed'
AND signal_detected = false
AND is_noise = false
AND monitored_pages.page_class != 'ambient'

Whitespace noise check (before signal creation):

prev.replace(/\s+/g,"") === curr.replace(/\s+/g,"")
→ is_noise = true, noise_reason = 'whitespace_only'
→ no signal created

Confidence model:

base         = SECTION_WEIGHTS[section_type]  (0.25 – 0.85)
recency_bonus = 0.05 / 0.10 / 0.15
obs_bonus    = min(0.15, (observations-1) * 0.05)
score        = min(1.0, base + recency_bonus + obs_bonus)

Confidence gates:

< 0.35         → suppressed, no signal, diff marked processed
0.35 – 0.64   → status = 'pending_review'
>= 0.65        → status = 'pending'

Deduplication (v4.1):

signal_hash = sha256(competitor_id:signal_type:section_type:diff_id)[:32]
UNIQUE INDEX on signal_hash (partial: WHERE signal_hash IS NOT NULL)
One signal per diff — anchored to the specific diff_id, not a calendar day.
Allows multiple real events on the same competitor+section+type within one day.

Ambient routing:

Ambient page diffs → detect-ambient-activity → activity_events table
Never enter the signals table.

------------------------------------------------
7. Pressure Index Stage
------------------------------------------------

Table: competitors.pressure_index

Formula:
  Σ(severity_weight × confidence × exp(-age_days × 0.2))
  + activity_events_48h × 0.15
  capped at 10.0

Threshold: pressure_index >= 5.0
  → pending_review signals promoted to pending
  → interpret-signals picks them up on next run

------------------------------------------------
8. Interpretation Stage
------------------------------------------------

signals.status transitions:

pending
→ in_progress    (claimed via FOR UPDATE SKIP LOCKED)
→ interpreted
→ failed

RPC: claim_pending_signals(batch_size=5)

Pre-interpretation skip:
  previous_excerpt === current_excerpt → mark interpreted, no OpenAI call

Prompt includes: competitor_name, signal_type, severity, page_type, page_url,
                 previous_excerpt (divergence-anchored), current_excerpt

Model: gpt-4o-mini, temperature=0, seed=42, json_object mode
PROMPT_VERSION = "v1" — bump to trigger re-interpretation of all signals.

-----------------------------------------------
9. Stuck Job Recovery
------------------------------------------------

reset_stuck_signals(30):
  status = 'in_progress' AND updated_at < now() - 30min → 'pending'

fail_exhausted_signals(5):
  retry_count >= 5 → status = 'failed'

Both called at start of every interpret-signals run.

------------------------------------------------
10. Dead Letter Policy
------------------------------------------------

signals retries: 5 (MAX_RETRIES)
After threshold: status = 'failed'

------------------------------------------------
11. Movement Detection Stage
------------------------------------------------

Table: strategic_movements

Window: 14 days (active clusters only — not 30d)
Filter: interpreted=true AND (confidence_score IS NULL OR confidence_score >= 0.40)
Minimum: 2 signals required per competitor to declare a movement

Confidence formula:
  avgConf * 0.65 + min(signalCount, 6) * 0.06
  capped at 0.95

Upsert on (competitor_id, movement_type) — idempotent across cron cycles.

------------------------------------------------
12. Idempotency
------------------------------------------------

Unique constraints prevent duplicates at every stage:

snapshots:           (monitored_page_id, content_hash)
page_sections:       (snapshot_id, section_type)
section_diffs:       (monitored_page_id, section_type, previous_section_id)
signals:             (section_diff_id, signal_type)
signals:             signal_hash (partial unique index)
strategic_movements: (competitor_id, movement_type)

All pipeline stages are safe to re-run.