METRIVANT — SYSTEM RUNTIME FLOW
Version: v1.1

------------------------------------------------
1. Runtime Stack
------------------------------------------------

GitHub
→ code

Vercel
→ cron runtime

Supabase
→ system state

OpenAI
→ interpretation

Sentry
→ monitoring

------------------------------------------------
2. Cron Schedule
------------------------------------------------

fetch-snapshots
every 6 hours

extract-sections
every 10 minutes

detect-signals
every 10 minutes

interpret-signals
every 10 minutes

generate-brief
weekly

------------------------------------------------
3. Fetch Runtime
------------------------------------------------

Reads:

monitored_pages

Writes:

snapshots

Key fields written:

monitored_page_id
raw_html
content_hash
fetched_at
sections_extracted = false

------------------------------------------------
4. Extraction Runtime
------------------------------------------------

Reads:

snapshots
extraction_rules

Writes:

page_sections
section_baselines
section_diffs

Finally updates:

snapshots.sections_extracted = true

------------------------------------------------
5. Signal Detection Runtime
------------------------------------------------

Reads:

section_diffs where

status = 'confirmed'
AND signal_detected = false

Writes:

signals

Updates:

section_diffs.signal_detected = true

------------------------------------------------
6. Interpretation Runtime
------------------------------------------------

Reads:

signals where status = 'pending'

Claim rows atomically.

Calls OpenAI.

Writes:

interpretations

Updates:

signals.status = 'interpreted'

------------------------------------------------
7. Brief Generation Runtime
------------------------------------------------

Reads interpreted signals from last week.

Produces weekly brief.

Writes:

briefs
brief_signals

------------------------------------------------
8. Runtime Metrics
------------------------------------------------

Each stage logs:

rows_claimed
rows_processed
rows_succeeded
rows_failed
runtime_duration_ms

These logs enable debugging pipeline stalls.

------------------------------------------------
9. Failure Recovery
------------------------------------------------

Serverless crashes do not corrupt state.

Pending rows remain in database.

Next cron execution resumes work.

This guarantees stateless recovery.