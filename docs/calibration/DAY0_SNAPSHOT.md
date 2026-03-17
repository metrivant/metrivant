# DAY 0 SNAPSHOT — Metrivant Calibration
**Date:** 2026-03-17
**Purpose:** Define system state at start of 14-day observation window.
**Operator:** [fill in]

---

## SCOPE DECISION

Selected scope: [fill in one]
- full_scope
- page_diff_plus_feeds
- page_diff_only
- page_diff_only + pending_review_bottleneck_unresolved
- page_diff_plus_feeds + pending_review_bottleneck_unresolved

**Scope rationale:** [fill in — based on gate results below]

---

## SYSTEM

```sql
SELECT count(*) FROM competitors WHERE active = true;
```
**Result:** [fill in]

```sql
SELECT health_state, count(*) FROM monitored_pages
WHERE active = true GROUP BY health_state;
```
**Result:**
| health_state | count |
|---|---|
| [fill in] | |

```sql
SELECT count(*) FROM section_baselines WHERE is_active = true;
```
**Result:** [fill in]

```sql
SELECT count(*) FROM extraction_rules;
```
**Result:** [fill in]

---

## SIGNALS

```sql
SELECT status, count(*) FROM signals GROUP BY status;
```
**Result:**
| status | count |
|---|---|
| [fill in] | |

```sql
SELECT source_type, count(*) FROM signals GROUP BY source_type;
```
**Result:**
| source_type | count |
|---|---|
| [fill in] | |

```sql
SELECT signal_type, count(*) FROM signals GROUP BY signal_type;
```
**Result:**
| signal_type | count |
|---|---|
| [fill in] | |

```sql
SELECT count(*) FROM interpretations;
```
**Result:** [fill in]

---

## FEEDS

```sql
SELECT discovery_status, count(*) FROM competitor_feeds
WHERE pool_type = 'newsroom'
GROUP BY discovery_status;
```
**Result:**
| discovery_status | count |
|---|---|
| [fill in] | |

```sql
SELECT count(*) FROM pool_events;
```
**Result (pre-cron):** [fill in]
**Result (post-cron):** [fill in after next :10]

---

## SYNTHESIS

```sql
SELECT count(*) FROM strategic_movements;
```
**Result:** [fill in]

```sql
SELECT count(*) FROM radar_narratives;
```
**Result:** [fill in]

```sql
SELECT count(*) FROM sector_intelligence;
```
**Result:** [fill in]

```sql
SELECT count(*) FROM weekly_briefs;
```
**Result:** [fill in]

---

## PIPELINE

```sql
SELECT stage, status, count(*) FROM pipeline_events
WHERE created_at > now() - interval '24 hours'
GROUP BY stage, status;
```
**Result:**
| stage | status | count |
|---|---|---|
| [fill in] | | |

---

## PRESSURE

```sql
SELECT name, pressure_index FROM competitors
WHERE pressure_index > 0 ORDER BY pressure_index DESC;
```
**Result:**
| name | pressure_index |
|---|---|
| [fill in] | |

---

## FETCH QUALITY

```sql
SELECT fetch_quality, count(*) FROM snapshots
WHERE fetched_at > now() - interval '7 days'
GROUP BY fetch_quality;
```
**Result:**
| fetch_quality | count |
|---|---|
| [fill in] | |

---

## PER-COMPETITOR

```sql
SELECT c.name,
       count(DISTINCT mp.id)                                                        AS pages,
       count(DISTINCT CASE WHEN mp.health_state = 'healthy' THEN mp.id END)         AS pages_healthy,
       count(DISTINCT s.id)                                                          AS signals,
       count(DISTINCT i.id)                                                          AS interpretations,
       CASE WHEN cf.feed_url IS NOT NULL THEN 'yes' ELSE 'no' END                   AS has_feed
FROM competitors c
LEFT JOIN monitored_pages mp ON mp.competitor_id = c.id AND mp.active = true
LEFT JOIN signals s ON s.competitor_id = c.id
LEFT JOIN interpretations i ON i.signal_id = s.id
LEFT JOIN competitor_feeds cf ON cf.competitor_id = c.id AND cf.pool_type = 'newsroom'
GROUP BY c.id, c.name, cf.feed_url
ORDER BY count(DISTINCT s.id) DESC;
```
**Result:**
| name | pages | pages_healthy | signals | interpretations | has_feed |
|---|---|---|---|---|---|
| [fill in] | | | | | |

---

## FEED INVENTORY

```sql
SELECT c.id, c.name, cf.feed_url, cf.discovery_status
FROM competitors c
JOIN competitor_feeds cf ON cf.competitor_id = c.id
WHERE cf.pool_type = 'newsroom'
ORDER BY c.name;
```
**Result:**
| id | name | feed_url | discovery_status |
|---|---|---|---|
| [fill in] | | | |

---

## MONITORED PAGE URLS (newsroom / blog / changelog)

```sql
SELECT c.id, c.name, mp.url, mp.page_type
FROM monitored_pages mp
JOIN competitors c ON c.id = mp.competitor_id
WHERE mp.page_type IN ('newsroom', 'blog', 'changelog')
AND mp.active = true
ORDER BY c.name;
```
**Result:**
| competitor_id | name | url | page_type |
|---|---|---|---|
| [fill in] | | | |

---

## FEED UPDATES APPLIED

Format: one row per UPDATE executed.

| competitor_name | competitor_id | feed_url | source_type | discovery_status | updated_at |
|---|---|---|---|---|---|
| [fill in] | | | | active | 2026-03-17 |

**SQL template used:**
```sql
UPDATE competitor_feeds
SET feed_url = '[url]',
    discovery_status = 'active',
    updated_at = now()
WHERE competitor_id = '[id]'
AND pool_type = 'newsroom';
```

---

## SIGNAL OVERRIDE AUDIT

```sql
SELECT id, competitor_id, signal_type, confidence_score, status, relevance_level, detected_at
FROM signals
WHERE status = 'pending_review'
ORDER BY confidence_score DESC;
```
**Candidates (pre-override):**
| id | competitor_id | signal_type | confidence_score | status | relevance_level | detected_at |
|---|---|---|---|---|---|---|
| [fill in] | | | | | | |

**Selected signal_id:** [fill in]
**Selection reason:** [highest confidence_score / tie-broken by monitored page count]
**Override timestamp:** [fill in — time UPDATE was executed]

**Override SQL executed:**
```sql
UPDATE signals
SET status = 'pending'
WHERE id = '[signal_id]'
AND status = 'pending_review';
```

---

## GATE RESULTS

### Gate 1 — Feed Gate (after next :10 cron)

```sql
SELECT count(*) FROM pool_events;
```
**Result:** [fill in]
**Status:** PASS (>0) / FAIL (=0)

Notes:
- If FAIL and discovery_status = active: mark feeds as "active but unverified"
- No further debugging per DAY 0 hard rules

### Gate 2 — Override Gate (after next :28 cron)

```sql
SELECT s.id, s.status, s.relevance_level,
       i.id AS interp_id, i.summary, i.confidence, i.urgency, i.model_used
FROM signals s
LEFT JOIN interpretations i ON i.signal_id = s.id
WHERE s.id = '[signal_id]';
```
**Result:**
| s.id | s.status | s.relevance_level | interp_id | summary | confidence | urgency | model_used |
|---|---|---|---|---|---|---|---|
| [fill in] | | | | | | | |

**Status:** PASS (interpretation exists) / CONDITIONAL PASS (filtered) / FAIL (none)

Notes:
- If relevance_level = 'low': signal filtered pre-interpretation → CONDITIONAL PASS
- If FAIL: logged; no debugging per DAY 0 hard rules

---

## PHASE 4 — VISIBILITY CHECK

Signal selected: [signal_id]
- Interpretation exists: yes / no
- Joins to competitor: yes / no
- Appears in radar_feed logic: yes / no

**Status:** PASS / FAIL

---

## FINAL SCOPE

Based on gate results:

| Gate | Status | Impact on scope |
|---|---|---|
| Feed gate | [PASS/FAIL] | [feeds active / feeds excluded] |
| Override gate | [PASS/FAIL] | [interpretation confirmed / pending review bottleneck flagged] |

**Final scope declared:** [fill in]

---

## START RULE

IF feeds FAIL AND override FAIL:
- constrained scope selected: `page_diff_only + pending_review_bottleneck_unresolved`
- no debugging performed
- Day 1 begins next calendar morning

---

## HANDLER VERIFICATION (static — no DB required)

**ingest-feeds filter conditions (confirmed from source):**
1. `pool_type = 'newsroom'` — required
2. `discovery_status = 'active'` — REQUIRED (handler will skip rows where this is 'pending')
3. `feed_url IS NOT NULL` — required (explicit `.not("feed_url", "is", null)` filter)

**Implication:** Every UPDATE applied in Phase 1 Step 6 MUST set both `feed_url` and `discovery_status = 'active'` or the feed will be silently skipped by the cron.

**source_type note:** `event_type` in pool_events is derived from `competitor_feeds.source_type`:
- `source_type = 'newsroom_feed'` → `event_type = 'newsroom_post'`
- everything else → `event_type = 'press_release'`

Set `source_type` deliberately when applying feed URLs.

---

## CONFIRMATION

Day 0 complete — calibration begins next calendar morning.

Signed: [operator]
Timestamp: [fill in]
