SUPERSEDED — see docs/METRIVANT_MASTER_REFERENCE.md

METRIVANT — MASTER ARCHITECTURE PLAN
Version: v1.1
Status: Pre-production architecture blueprint

------------------------------------------------
1. Core System Philosophy
------------------------------------------------

Metrivant is a deterministic competitive intelligence engine.

Detection = deterministic code
Interpretation = AI

Pipeline:

fetch
→ snapshot
→ extract section
→ validate extraction
→ compare to baseline
→ generate diff
→ detect signal
→ interpret signal
→ weekly intelligence brief

Code decides whether a change happened.
AI decides what the change means.

------------------------------------------------
2. Infrastructure Architecture
------------------------------------------------

GitHub
→ source control

Vercel Pro
→ runtime
→ cron scheduler

Supabase Pro
→ PostgreSQL state engine
→ backups

OpenAI API
→ signal interpretation
→ brief generation

Sentry
→ runtime monitoring
→ cron monitoring

No Redis, Kafka, or worker infrastructure.

------------------------------------------------
3. Supabase as State Engine
------------------------------------------------

The database is the system state machine.

Examples:

snapshots.sections_extracted = false
→ extraction pending

section_diffs.status = 'confirmed'
AND signal_detected = false
→ signal detection pending

signals.status = 'pending'
→ interpretation pending

------------------------------------------------
4. Core Data Model
------------------------------------------------

monitored_pages
logical monitored pages
multiple rows may share same URL

extraction_rules
selector-based extraction config

snapshots
HTML snapshots and fetch metadata

page_sections
extracted section content

section_baselines
stable section reference

section_diffs
confirmed divergence from baseline

signals
structured competitive events

interpretations
AI explanation of signals

briefs
weekly intelligence output

------------------------------------------------
5. Queue Architecture
------------------------------------------------

Queues are implemented through row state.

Each stage:

select pending rows
claim rows atomically
process claimed rows
update state

Example atomic claim pattern:

Atomic claiming should use PostgreSQL row locking via FOR UPDATE SKIP LOCKED where appropriate.

UPDATE signals
SET status = 'interpreting'
WHERE id IN (
  SELECT id
  FROM signals
  WHERE status = 'pending'
  ORDER BY detected_at
  LIMIT 10
  FOR UPDATE SKIP LOCKED
)
RETURNING *;

------------------------------------------------
6. Baseline Comparison Logic
------------------------------------------------

Compare:

current_hash
baseline_hash
previous_hash

cases:

current == baseline
→ no diff

current != baseline AND previous == baseline
→ unconfirmed

current != baseline AND previous == current
→ confirmed

current != baseline AND previous != current
→ unstable

Only confirmed diffs produce signals.

------------------------------------------------
7. Structured Parsing
------------------------------------------------

Structured parsing focuses first on pricing.

Extract:

tier_name
price
billing_period
features
cta

Stored in page_sections.structured_content.

Parsing must remain additive.

------------------------------------------------
8. Interpretation Layer
------------------------------------------------

Inputs:

signal_type
signal_data
old_content
new_content

Outputs:

summary
strategic_implication
recommended_action
confidence

Interpretation never affects detection.

------------------------------------------------
9. Scaling Philosophy
------------------------------------------------

Current target scale:

3–20 competitors
3–5 pages each

Architecture supports dozens of pages without change.

Scaling improvements occur only when runtime evidence demands them.

------------------------------------------------
10. Guiding Principle
------------------------------------------------

Observe real runtime behaviour before redesign.

The system evolves from operational evidence.