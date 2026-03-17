# SENTRY POST-DEPLOY CHECKLIST

Run this checklist after deploying the Sentry observability hardening (Phase 1–6).
Code changes are useless without completing this manual configuration in the Sentry UI.

---

## 1. CREATE MONITORS FOR ALL FRONTEND CRON SLUGS

In Sentry → Crons → Create Monitor for each slug below.
These are the check-ins emitted by the radar-ui handlers.

| Monitor slug        | Handler                       | Schedule              |
|---------------------|-------------------------------|-----------------------|
| `check-signals`     | radar-ui/api/check-signals    | Hourly (`0 * * * *`)  |
| `update-momentum`   | radar-ui/api/update-momentum  | Every 6h (`0 */6 * * *`) |
| `strategic-analysis`| radar-ui/api/strategic-analysis | Daily 08:00 UTC (`0 8 * * *`) |
| `update-positioning`| radar-ui/api/update-positioning | Daily 09:00 UTC (`0 9 * * *`) |
| `generate-brief`    | radar-ui/api/generate-brief   | Monday 10:00 UTC (`0 10 * * 1`) |

For each monitor, configure:
- **Expected interval**: match the schedule above
- **Miss tolerance**: 5 minutes
- **Failure tolerance**: 1 consecutive failure before alerting

---

## 2. VERIFY RUNTIME MONITORS MATCH CODE

Runtime slugs already emit check-ins. Confirm the monitors exist and are healthy.
Check: Sentry → Crons — all the following should show a recent green check-in.

Key runtime slugs to verify (hourly/sub-hourly):
- `fetch-snapshots-ambient`
- `fetch-snapshots-high_value`
- `fetch-snapshots-standard`
- `extract-sections`
- `build-baselines`
- `detect-diffs`
- `detect-signals`
- `interpret-signals`
- `update-pressure-index`
- `synthesize-movement-narratives`
- `generate-radar-narratives`

Weekly slugs:
- `generate-sector-intelligence`
- `watchdog` (every 15 minutes — verify this is active post-deploy)

---

## 3. CONFIGURE MISSED CHECK-IN ALERTS

For each monitor created in Step 1, configure alerts:

**Trigger**: missed check-in (cron did not report `in_progress` or `ok` within window)
**Severity**: critical for `check-signals` and `watchdog`; warning for others

How: Sentry → Crons → select monitor → Edit → Notifications → enable missed check-in.

Do this for ALL monitors. A monitor without alerts is silent.

---

## 4. DEFINE NOTIFICATION CHANNEL

In Sentry → Alerts → Notification Rules:
- Add email notification to the primary operator address
- Optional: add Slack webhook if workspace is available

Ensure at minimum: **one email address receives critical cron alerts**.

---

## 5. VERIFY WATCHDOG EVENTS APPEAR

After deploy, wait up to 15 minutes (next cron window: `*/15 * * * *`).

Check:
1. Sentry → Crons → `watchdog` monitor → should show `in_progress` then `ok`
2. If any pipeline stage is stale: Sentry → Issues → filter by `watchdog_stale_stage` message
3. If watchdog itself fails: Sentry → Issues → error from `watchdog` function

The watchdog checks 6 stages:
- `snapshot` (threshold: 60 min, source: pipeline_events)
- `extract` (threshold: 30 min, source: pipeline_events)
- `diff` (threshold: 30 min, source: pipeline_events)
- `signal` (threshold: 30 min, source: pipeline_events)
- `interpret` (threshold: 60 min, source: pipeline_events)
- `baseline` (threshold: 30 min, source: section_baselines — fallback)

If `check-signals` or `update-momentum` did not run recently, the watchdog will NOT detect
those — they are frontend handlers and are observable only via their Sentry cron check-ins.

---

## 6. VERIFY ENVIRONMENT AND RELEASE TAGGING

In Sentry → Settings → Projects → verify:
- Runtime project: `environment` should show `production` for Vercel production deployments
- UI project: same
- `release` should show a git commit SHA (populated via `VERCEL_GIT_COMMIT_SHA` env var)

If missing: confirm `SENTRY_DSN` (not `SENTRY_DNS`) is set in both Vercel projects.

---

## 7. SIMULATE FAILURE → CONFIRM ALERT FIRES

Before relying on monitoring in production, validate that alerts actually fire.

**Method A — missed check-in test:**
1. Temporarily set the monitor interval for `check-signals` to 2 minutes
2. Wait 5 minutes without a check-in (the cron will not fire outside its window)
3. Confirm: Sentry sends a missed check-in alert
4. Restore the monitor to the correct interval

**Method B — manual error injection (staging only):**
1. Call `/api/check-signals` without the Authorization header → 401 (no check-in emitted)
2. Call `/api/check-signals` with a valid secret but broken SUPABASE_URL → should emit `error` check-in
3. Confirm: Sentry shows the `error` status in the monitor timeline

---

## 8. AI LATENCY VERIFICATION

After deploy, verify AI latency is being recorded:

```sql
SELECT stage, status, duration_ms, metadata
FROM pipeline_events
WHERE stage IN ('movement_synthesis', 'radar_narrative', 'sector_intelligence', 'brief_generation', 'interpret')
ORDER BY created_at DESC
LIMIT 20;
```

Expected: rows appear with `duration_ms > 0` and `metadata.model` populated.

---

## 9. TIMEOUT RISK REPORT

No `maxDuration` is set in either `vercel.json`. All functions default to **60 seconds**.

| Handler                        | AI model  | Timeout risk                     |
|--------------------------------|-----------|----------------------------------|
| `interpret-signals`            | gpt-4o-mini | Low — per-signal, batched        |
| `synthesize-movement-narratives` | gpt-4o  | Medium — per-movement, sequential |
| `generate-radar-narratives`    | gpt-4o-mini | Low — per-competitor             |
| `generate-sector-intelligence` | gpt-4o    | Medium — per-org, large context  |
| `generate-brief` (radar-ui)    | gpt-4o    | Medium — per-org, large prompt   |

If AI latency exceeds 60s: add `maxDuration: 300` to individual function configs or in `vercel.json` functions block.
Monitor via `duration_ms` in pipeline_events to detect approaching-timeout patterns.

---

## DONE CRITERIA

- [ ] All 5 frontend cron monitors created in Sentry UI
- [ ] All runtime monitors verified as active
- [ ] Missed check-in alerts configured for all monitors
- [ ] Notification channel configured (at minimum: email)
- [ ] Watchdog check-in appears in Sentry within 15 minutes of deploy
- [ ] Failure simulation confirms alert fires
- [ ] AI latency rows visible in pipeline_events
- [ ] SENTRY_DSN confirmed in both Vercel project env vars
