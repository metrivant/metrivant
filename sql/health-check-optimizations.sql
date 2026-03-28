-- ══════════════════════════════════════════════════════════════════════════════
-- METRIVANT SYSTEM HEALTH CHECK & OPTIMIZATION QUERIES
-- Generated: 2026-03-28
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. INDEX ANALYSIS - Check for missing indexes on frequently queried columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Check existing indexes on key tables
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'signals',
    'interpretations',
    'strategic_movements',
    'pipeline_events',
    'snapshots',
    'monitored_pages'
  )
ORDER BY tablename, indexname;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VALIDATION EFFECTIVENESS - Sector-aware validation metrics
-- ─────────────────────────────────────────────────────────────────────────────

-- Validation status distribution
SELECT
  validation_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM interpretations
WHERE validation_status IS NOT NULL
GROUP BY validation_status
ORDER BY count DESC;

-- Validation by competitor (top 10)
SELECT
  c.name as competitor,
  COUNT(i.id) as interpretations,
  SUM(CASE WHEN i.validation_status = 'valid' THEN 1 ELSE 0 END) as valid,
  SUM(CASE WHEN i.validation_status = 'weak' THEN 1 ELSE 0 END) as weak,
  SUM(CASE WHEN i.validation_status = 'hallucinated' THEN 1 ELSE 0 END) as hallucinated,
  ROUND(
    SUM(CASE WHEN i.validation_status = 'hallucinated' THEN 1 ELSE 0 END) * 100.0 /
    NULLIF(COUNT(i.id), 0),
    2
  ) as hallucination_rate
FROM interpretations i
JOIN signals s ON s.id = i.signal_id
JOIN competitors c ON c.id = s.competitor_id
WHERE i.validation_status IS NOT NULL
GROUP BY c.id, c.name
HAVING COUNT(i.id) >= 5
ORDER BY interpretations DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SIGNAL QUALITY ANALYSIS
-- ─────────────────────────────────────────────────────────────────────────────

-- Signal confidence distribution
SELECT
  CASE
    WHEN confidence_score < 0.35 THEN '<0.35 (suppressed)'
    WHEN confidence_score < 0.65 THEN '0.35-0.64 (pending_review)'
    ELSE '0.65+ (promoted)'
  END as confidence_bucket,
  COUNT(*) as count,
  ROUND(AVG(confidence_score), 3) as avg_confidence
FROM signals
GROUP BY 1
ORDER BY 1;

-- Signal types by status
SELECT
  signal_type,
  status,
  COUNT(*) as count
FROM signals
GROUP BY signal_type, status
ORDER BY signal_type, status;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SNAPSHOT BACKLOG ANALYSIS
-- ─────────────────────────────────────────────────────────────────────────────

-- Snapshot processing statistics
SELECT
  sections_extracted,
  fetch_quality,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM snapshots
GROUP BY sections_extracted, fetch_quality
ORDER BY sections_extracted, fetch_quality;

-- Oldest unprocessed snapshots (potential stuck items)
SELECT
  s.id,
  c.name as competitor,
  mp.page_type,
  s.created_at,
  s.fetch_quality,
  s.failure_count,
  EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600 as age_hours
FROM snapshots s
JOIN monitored_pages mp ON mp.id = s.monitored_page_id
JOIN competitors c ON c.id = mp.competitor_id
WHERE s.sections_extracted = false
  AND s.fetch_quality = 'full'
ORDER BY s.created_at ASC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PIPELINE PERFORMANCE METRICS (last 24h)
-- ─────────────────────────────────────────────────────────────────────────────

-- Stage performance summary
SELECT
  stage,
  status,
  COUNT(*) as runs,
  ROUND(AVG(duration_ms), 0) as avg_duration_ms,
  ROUND(MIN(duration_ms), 0) as min_duration_ms,
  ROUND(MAX(duration_ms), 0) as max_duration_ms
FROM pipeline_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY stage, status
ORDER BY stage, status;

-- Recent failures
SELECT
  stage,
  timestamp,
  metadata->>'error' as error
FROM pipeline_events
WHERE status = 'failure'
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SECTOR DISTRIBUTION & VALIDATION
-- ─────────────────────────────────────────────────────────────────────────────

-- Sector distribution across organizations
SELECT
  sector,
  COUNT(*) as org_count,
  SUM((SELECT COUNT(*) FROM tracked_competitors WHERE org_id = organizations.id)) as competitors_tracked
FROM organizations
GROUP BY sector
ORDER BY org_count DESC;

-- Competitors by sector (via tracked_competitors)
SELECT
  o.sector,
  COUNT(DISTINCT tc.competitor_id) as competitors,
  COUNT(DISTINCT s.id) as signals,
  ROUND(AVG(s.confidence_score), 3) as avg_confidence
FROM organizations o
JOIN tracked_competitors tc ON tc.org_id = o.id
LEFT JOIN signals s ON s.competitor_id = tc.competitor_id
GROUP BY o.sector
ORDER BY competitors DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. POOL SYSTEM HEALTH
-- ─────────────────────────────────────────────────────────────────────────────

-- Pool events by source type (last 7 days)
SELECT
  source_type,
  COUNT(*) as events,
  COUNT(DISTINCT competitor_id) as competitors
FROM pool_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY source_type
ORDER BY events DESC;

-- Feed health
SELECT
  source_type,
  discovery_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY source_type), 2) as pct_of_source
FROM competitor_feeds
GROUP BY source_type, discovery_status
ORDER BY source_type, discovery_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. DATA CLEANUP OPPORTUNITIES
-- ─────────────────────────────────────────────────────────────────────────────

-- Old failed signals (>7 days) - could be cleaned up
SELECT COUNT(*) as old_failed_signals
FROM signals
WHERE status = 'failed'
  AND detected_at < NOW() - INTERVAL '7 days';

-- Interpretations without validation (>24h old)
SELECT COUNT(*) as unvalidated_interpretations
FROM interpretations
WHERE validation_status IS NULL
  AND created_at < NOW() - INTERVAL '24 hours';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. OPTIMIZATION RECOMMENDATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'snapshots',
    'page_sections',
    'section_diffs',
    'signals',
    'interpretations',
    'pool_events',
    'pipeline_events'
  )
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ═════════════════════════════════════════════════════════════════════════════
-- END OF HEALTH CHECK QUERIES
-- ═════════════════════════════════════════════════════════════════════════════
