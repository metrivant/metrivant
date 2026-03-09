METRIVANT — OPERATIONS GUIDE
Version: v1.1

------------------------------------------------
1. Daily Health Checks
------------------------------------------------

Extraction blackout detection:

SELECT mp.id
FROM monitored_pages mp
LEFT JOIN page_sections ps
  ON ps.monitored_page_id = mp.id
  AND ps.validation_status = 'valid'
  AND ps.created_at > NOW() - INTERVAL '48 hours'
WHERE mp.active = true
GROUP BY mp.id
HAVING COUNT(ps.id) = 0;

------------------------------------------------

Baseline freshness:

SELECT monitored_page_id, section_type
FROM section_baselines
WHERE last_confirmed_at < NOW() - INTERVAL '30 days';

------------------------------------------------

Signal pipeline activity:

SELECT COUNT(*)
FROM signals
WHERE detected_at > NOW() - INTERVAL '7 days';

------------------------------------------------

Interpretation backlog:

SELECT COUNT(*)
FROM signals
WHERE status = 'pending';

------------------------------------------------

Stuck interpretations:

SELECT id
FROM signals
WHERE status = 'interpreting'
AND detected_at < NOW() - INTERVAL '30 minutes';

------------------------------------------------

Fetch health:

SELECT MAX(fetched_at)
FROM snapshots;

------------------------------------------------
2. Weekly Review
------------------------------------------------

Signal distribution:

SELECT signal_type, COUNT(*)
FROM signals
WHERE detected_at > NOW() - INTERVAL '7 days'
GROUP BY signal_type;

------------------------------------------------

Unstable sections:

SELECT monitored_page_id, section_type
FROM section_diffs
WHERE status = 'unstable';

------------------------------------------------

Interpretation confidence:

SELECT
AVG(confidence),
MIN(confidence),
MAX(confidence)
FROM interpretations
WHERE created_at > NOW() - INTERVAL '7 days';

------------------------------------------------
3. Queue Monitoring
------------------------------------------------

Snapshot backlog:

SELECT COUNT(*)
FROM snapshots
WHERE sections_extracted = false;

------------------------------------------------

Diff backlog:

SELECT COUNT(*)
FROM section_diffs
WHERE status = 'confirmed'
AND signal_detected = false;

------------------------------------------------

Signal backlog:

SELECT COUNT(*)
FROM signals
WHERE status = 'pending';

------------------------------------------------
4. Manual Recovery Tools
------------------------------------------------

Reset signal:

UPDATE signals
SET status = 'pending'
WHERE id = 'SIGNAL_ID';

------------------------------------------------

Re-run extraction:

UPDATE snapshots
SET sections_extracted = false
WHERE id = 'SNAPSHOT_ID';

------------------------------------------------

Promote diff:

UPDATE section_diffs
SET status = 'confirmed'
WHERE id = 'DIFF_ID';

------------------------------------------------
5. Storage Monitoring
------------------------------------------------

Database size:

SELECT pg_size_pretty(pg_database_size(current_database()));

------------------------------------------------
6. Operator Checklist
------------------------------------------------

Daily:

check health queries
check Sentry alerts

Weekly:

review signals
review unstable sections
read weekly brief

Monthly:

review database size
review selector health
review signal taxonomy