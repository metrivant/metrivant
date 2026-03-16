-- Pipeline throughput: events per stage per hour (last 24h)
SELECT
  stage,
  date_trunc('hour', created_at) AS hour,
  COUNT(*) AS event_count,
  COUNT(*) FILTER (WHERE status = 'success') AS successes,
  COUNT(*) FILTER (WHERE status = 'failure') AS failures
FROM pipeline_events
WHERE created_at > now() - interval '24 hours'
GROUP BY stage, hour
ORDER BY hour DESC, stage;

-- Extraction health: validation states over time
SELECT
  date_trunc('day', created_at) AS day,
  metadata->>'validation_state' AS validation_state,
  COUNT(*) AS count
FROM pipeline_events
WHERE stage = 'extract'
  AND created_at > now() - interval '7 days'
GROUP BY day, validation_state
ORDER BY day DESC;

-- Signal generation rate: signals per day
SELECT
  date_trunc('day', created_at) AS day,
  SUM((metadata->>'signal_count')::int) AS total_signals
FROM pipeline_events
WHERE stage = 'signal'
  AND created_at > now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;

-- Diff rate: proportion of comparisons that produce diffs
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*) AS total_comparisons,
  COUNT(*) FILTER (WHERE (metadata->>'changed')::boolean = true) AS changed,
  ROUND(
    COUNT(*) FILTER (WHERE (metadata->>'changed')::boolean = true)::numeric
    / NULLIF(COUNT(*), 0),
    3
  ) AS diff_rate
FROM pipeline_events
WHERE stage = 'compare'
  AND created_at > now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;

-- Noise ratio: diffs that produced zero signals
SELECT
  date_trunc('day', d.created_at) AS day,
  COUNT(*) AS total_diffs,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_events s
    WHERE s.stage = 'signal'
      AND s.section_diff_id = d.section_diff_id
      AND (s.metadata->>'signal_count')::int > 0
  )) AS zero_signal_diffs,
  ROUND(
    COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM pipeline_events s
      WHERE s.stage = 'signal'
        AND s.section_diff_id = d.section_diff_id
        AND (s.metadata->>'signal_count')::int > 0
    ))::numeric / NULLIF(COUNT(*), 0),
    3
  ) AS noise_ratio
FROM pipeline_events d
WHERE d.stage = 'diff'
  AND d.section_diff_id IS NOT NULL
  AND d.created_at > now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;

-- Stage duration percentiles (last 7 days)
SELECT
  stage,
  COUNT(*) AS samples,
  ROUND(AVG(duration_ms)) AS avg_ms,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
  MAX(duration_ms) AS max_ms
FROM pipeline_events
WHERE duration_ms IS NOT NULL
  AND created_at > now() - interval '7 days'
GROUP BY stage
ORDER BY stage;

-- LLM cost tracking: token usage per day
SELECT
  date_trunc('day', created_at) AS day,
  SUM((metadata->>'prompt_tokens')::int) AS total_prompt_tokens,
  SUM((metadata->>'completion_tokens')::int) AS total_completion_tokens
FROM pipeline_events
WHERE stage = 'interpret'
  AND created_at > now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;

-- Per-page extraction reliability (last 30 days)
SELECT
  monitored_page_id,
  COUNT(*) AS total_extractions,
  COUNT(*) FILTER (WHERE metadata->>'validation_state' = 'valid') AS valid,
  COUNT(*) FILTER (WHERE metadata->>'validation_state' = 'suspect') AS suspect,
  COUNT(*) FILTER (WHERE metadata->>'validation_state' = 'failed') AS failed,
  ROUND(
    COUNT(*) FILTER (WHERE metadata->>'validation_state' = 'valid')::numeric
    / NULLIF(COUNT(*), 0),
    3
  ) AS reliability_rate
FROM pipeline_events
WHERE stage = 'extract'
  AND created_at > now() - interval '30 days'
GROUP BY monitored_page_id
ORDER BY reliability_rate ASC;

-- Reconstruct a single pipeline run
SELECT
  stage,
  status,
  duration_ms,
  monitored_page_id,
  section_diff_id,
  metadata,
  created_at
FROM pipeline_events
WHERE run_id = '<INSERT_RUN_ID>'
ORDER BY created_at ASC;


-- ── Signal feedback diagnostics ───────────────────────────────────────────────

-- Feedback coverage
SELECT
  COUNT(DISTINCT s.id) AS total_signals,
  COUNT(DISTINCT sf.signal_id) AS reviewed_signals,
  ROUND(
    COUNT(DISTINCT sf.signal_id)::numeric / NULLIF(COUNT(DISTINCT s.id), 0),
    3
  ) AS review_rate
FROM signals s
LEFT JOIN signal_feedback sf ON sf.signal_id = s.id
WHERE s.created_at > now() - interval '30 days';

-- Verdict distribution
SELECT
  verdict,
  COUNT(*) AS count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0), 3) AS proportion
FROM signal_feedback
WHERE created_at > now() - interval '30 days'
GROUP BY verdict
ORDER BY count DESC;

-- Noise categories
SELECT
  COALESCE(noise_category, '(uncategorized)') AS category,
  COUNT(*) AS count
FROM signal_feedback
WHERE verdict = 'noise'
  AND created_at > now() - interval '30 days'
GROUP BY noise_category
ORDER BY count DESC;

-- Noise rate by section type
-- Join path: signals.section_diff_id → section_diffs.id → section_diffs.section_type
SELECT
  sd.section_type,
  COUNT(*) AS total_signals,
  COUNT(*) FILTER (WHERE sf.verdict = 'noise') AS noise_count,
  ROUND(
    COUNT(*) FILTER (WHERE sf.verdict = 'noise')::numeric / NULLIF(COUNT(*), 0),
    3
  ) AS noise_rate
FROM signals s
JOIN section_diffs sd ON sd.id = s.section_diff_id
LEFT JOIN signal_feedback sf ON sf.signal_id = s.id
WHERE s.created_at > now() - interval '30 days'
GROUP BY sd.section_type
ORDER BY noise_rate DESC;

-- Noise rate by monitored page
-- Join path: signals.monitored_page_id → monitored_pages.id → monitored_pages.url
SELECT
  mp.url,
  COUNT(*) AS total_signals,
  COUNT(*) FILTER (WHERE sf.verdict = 'noise') AS noise_count,
  ROUND(
    COUNT(*) FILTER (WHERE sf.verdict = 'noise')::numeric / NULLIF(COUNT(*), 0),
    3
  ) AS noise_rate
FROM signals s
JOIN monitored_pages mp ON mp.id = s.monitored_page_id
LEFT JOIN signal_feedback sf ON sf.signal_id = s.id
WHERE s.created_at > now() - interval '30 days'
GROUP BY mp.url
ORDER BY noise_rate DESC;

-- Noise rate over time
SELECT
  date_trunc('week', sf.created_at) AS week,
  COUNT(*) AS total_reviewed,
  COUNT(*) FILTER (WHERE sf.verdict = 'noise') AS noise,
  COUNT(*) FILTER (WHERE sf.verdict = 'valid') AS valid,
  ROUND(
    COUNT(*) FILTER (WHERE sf.verdict = 'noise')::numeric / NULLIF(COUNT(*), 0),
    3
  ) AS noise_rate
FROM signal_feedback sf
GROUP BY week
ORDER BY week DESC;

-- Recent noise examples
SELECT
  sf.verdict,
  sf.noise_category,
  sf.notes,
  s.*
FROM signal_feedback sf
JOIN signals s ON s.id = sf.signal_id
WHERE sf.verdict = 'noise'
ORDER BY sf.created_at DESC
LIMIT 50;


-- ── Retention diagnostics ─────────────────────────────────────────────────────

-- Tier 1: raw HTML rows eligible for nulling (and estimated space)
SELECT
  COUNT(*) AS snapshots_to_null,
  pg_size_pretty(SUM(octet_length(raw_html))) AS estimated_html_space_freed
FROM snapshots
WHERE sections_extracted = true
  AND fetched_at < now() - interval '7 days'
  AND raw_html IS NOT NULL;

-- Tier 2: page_sections eligible for deletion (FK-safe count)
SELECT COUNT(*) AS sections_to_delete
FROM page_sections ps
WHERE ps.created_at < now() - interval '90 days'
  AND NOT EXISTS (
        SELECT 1 FROM section_baselines sb WHERE sb.source_section_id = ps.id
      )
  AND NOT EXISTS (
        SELECT 1 FROM section_diffs sd
        WHERE sd.previous_section_id = ps.id OR sd.current_section_id = ps.id
      );

-- Tier 2: sections ineligible because still referenced
SELECT COUNT(*) AS sections_skipped_referenced
FROM page_sections ps
WHERE ps.created_at < now() - interval '90 days'
  AND (
    EXISTS (SELECT 1 FROM section_baselines sb WHERE sb.source_section_id = ps.id)
    OR EXISTS (
         SELECT 1 FROM section_diffs sd
         WHERE sd.previous_section_id = ps.id OR sd.current_section_id = ps.id
       )
  );

-- Tier 3: section_diffs eligible for deletion (FK-safe count)
SELECT COUNT(*) AS diffs_to_delete
FROM section_diffs sd
WHERE sd.signal_detected = true
  AND sd.last_seen_at < now() - interval '180 days'
  AND NOT EXISTS (SELECT 1 FROM signals sig WHERE sig.section_diff_id = sd.id);

-- Tier 3: diffs ineligible because still referenced by signals
SELECT COUNT(*) AS diffs_skipped_referenced
FROM section_diffs sd
WHERE sd.signal_detected = true
  AND sd.last_seen_at < now() - interval '180 days'
  AND EXISTS (SELECT 1 FROM signals sig WHERE sig.section_diff_id = sd.id);

-- Tier 4: pipeline_events eligible for deletion
SELECT COUNT(*) AS events_to_delete
FROM pipeline_events
WHERE created_at < now() - interval '90 days';

-- Retention run history (last 30 days)
SELECT
  created_at,
  status,
  metadata->>'raw_html_nulled'  AS raw_html_nulled,
  metadata->>'sections_deleted' AS sections_deleted,
  metadata->>'diffs_deleted'    AS diffs_deleted,
  metadata->>'events_deleted'   AS events_deleted
FROM pipeline_events
WHERE stage = 'retention'
  AND created_at > now() - interval '30 days'
ORDER BY created_at DESC;
