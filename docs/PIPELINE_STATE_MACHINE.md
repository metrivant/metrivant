METRIVANT — PIPELINE STATE MACHINE
Version: v1.1

------------------------------------------------
1. Pipeline Overview
------------------------------------------------

fetch
→ snapshot
→ extract section
→ validate extraction
→ baseline comparison
→ diff detection
→ signal detection
→ signal interpretation
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

New signal:

status = 'pending'

------------------------------------------------
7. Interpretation Stage
------------------------------------------------

signals.status transitions:

pending
→ interpreting
→ interpreted
→ failed

Atomic claim:

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

-----------------------------------------------
8. Stuck Job Recovery
------------------------------------------------

Signals may remain stuck in interpreting.

Recovery query:

UPDATE signals
SET status = 'pending'
WHERE status = 'interpreting'
AND updated_at < NOW() - INTERVAL '30 minutes';

------------------------------------------------
9. Dead Letter Policy
------------------------------------------------

Retries limited.

Example limits:

snapshots retries: 3
section_diffs retries: 3
signals retries: 5

After threshold:

status = 'failed'

------------------------------------------------
10. Idempotency
------------------------------------------------

Unique constraints prevent duplicates.

Examples:

signals unique:

(section_diff_id, signal_type)

Pipeline stages are safe to rerun.