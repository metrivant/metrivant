# Sentry Observability Audit

**Date:** 2026-03-17
**Scope:** Full audit of Sentry integration across both Metrivant surfaces — runtime (`metrivant-runtime`) and frontend (`metrivant-ui`). Read-only investigation. No code, config, or Sentry settings were modified.

---

## 1. Sentry Initialization

### Runtime (`lib/sentry.ts`)

- **Package:** `@sentry/node`
- **DSN source:** `SENTRY_DSN ?? SENTRY_DNS` — active typo fallback (see §10)
- **Traces:** `tracesSampleRate: 0.05` in production, `1.0` in development
- **Environment:** `VERCEL_ENV ?? NODE_ENV`
- **Release:** `VERCEL_GIT_COMMIT_SHA`
- **`beforeSend`:** not configured
- **Verdict:** solid. Env and release tracking are correct. Traces are appropriately sampled for production.

### Frontend (`radar-ui/lib/sentry.ts`)

- **Package:** `@sentry/nextjs` (lazy init)
- **DSN source:** `SENTRY_DSN ?? SENTRY_DNS` — same typo fallback
- **Traces:** `tracesSampleRate: 0` — **traces disabled entirely**
- **Environment:** not set
- **Release:** not set
- **`sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts`:** none present
- **`withSentryConfig` in `next.config.ts`:** not configured
- **Exports:** `captureException` and `captureMessage` only — no `captureCheckIn`
- **Verdict:** minimal. Environment and release are blind. Traces are off. Sentry SDK is present for exception capture only — not for performance or cron monitoring.

---

## 2. Handler Wrapper Coverage

### Runtime: `lib/withSentry.ts`

All 20 scheduled runtime handlers are wrapped with `withSentry`. The wrapper:

- Catches unhandled exceptions and calls `Sentry.captureException`
- Tags the function name via `Sentry.setTag("function", name)`
- Calls `Sentry.flush(2000)` before returning 500
- Does NOT suppress the error — re-throws after flush

**Verdict:** runtime exception coverage is complete. Any unhandled throw in any runtime handler will be captured and flushed before the function exits.

### Frontend: no equivalent wrapper

Frontend cron handlers (`/api/check-signals`, `/api/generate-brief`, `/api/update-momentum`, `/api/strategic-analysis`, `/api/update-positioning`) each manage Sentry manually with ad-hoc `try/catch` blocks and `captureException` calls. There is no shared wrapper enforcing flush discipline.

**Verdict:** frontend exception coverage is inconsistent. Missed exceptions in frontend crons will silently disappear.

---

## 3. Sentry Check-in Coverage (Cron Monitors)

### Runtime — 20 scheduled cron slots

All active scheduled runtime handlers emit `captureCheckIn` with both `in_progress` and `ok`/`error` status. All use `Sentry.flush(2000)` in both success and error paths.

| Handler | Monitor Slug | Check-in |
|---|---|---|
| `fetch-snapshots` (ambient) | `fetch-snapshots-ambient` | ✅ |
| `fetch-snapshots` (high_value) | `fetch-snapshots-high-value` | ✅ |
| `fetch-snapshots` (standard) | `fetch-snapshots-standard` | ✅ |
| `extract-sections` | `extract-sections` | ✅ |
| `build-baselines` | `build-baselines` | ✅ |
| `detect-diffs` | `detect-diffs` | ✅ |
| `detect-signals` | `detect-signals` | ✅ |
| `detect-ambient-activity` | `detect-ambient-activity` | ✅ |
| `update-pressure-index` | `update-pressure-index` | ✅ |
| `interpret-signals` | `interpret-signals` | ✅ |
| `update-signal-velocity` | `update-signal-velocity` | ✅ |
| `detect-movements` | `detect-movements` | ✅ |
| `synthesize-movement-narratives` | `synthesize-movement-narratives` | ✅ |
| `generate-radar-narratives` | `generate-radar-narratives` | ✅ |
| `generate-sector-intelligence` | `generate-sector-intelligence` | ✅ |
| `ingest-feeds` | `ingest-feeds` | ✅ |
| `promote-feed-signals` | `promote-feed-signals` | ✅ |
| `promote-baselines` | `promote-baselines` | ✅ |
| `retention` | `retention` | ✅ |
| `suggest-selector-repairs` | `suggest-selector-repairs` | ✅ |

**Verdict:** runtime cron monitor coverage is complete.

### Frontend — 5 scheduled cron slots

| Handler | Monitor Slug | Check-in |
|---|---|---|
| `check-signals` | none | ❌ |
| `generate-brief` | `generate-brief` | ✅ |
| `update-momentum` | none | ❌ |
| `strategic-analysis` | none | ❌ |
| `update-positioning` | none | ❌ |

**4 of 5 frontend crons have no Sentry check-in monitor.** If any of these handlers silently miss their schedule (Vercel cron misfire, deployment gap, unhandled exception before captureException is reached), Sentry will not detect the absence.

`generate-brief` uses `captureCheckIn` via a `require("@sentry/nextjs")` workaround because the lazy-init frontend sentry module does not expose `captureCheckIn`. This works but is fragile — it bypasses the module interface.

---

## 4. Flush Discipline

### Runtime

Every runtime handler flushes via `Sentry.flush(2000)` in both success and error paths, enforced by the `withSentry` wrapper and the per-handler `finalize()` pattern. No runtime handler was found that could exit without flushing.

### Frontend

- `generate-brief`: flushes in both ok and error paths ✅
- `check-signals`: uses `captureException` in catch block but **no explicit flush** — relies on Next.js process lifecycle
- `update-momentum`: no flush found
- `strategic-analysis`: no flush found
- `update-positioning`: no flush found

**Verdict:** frontend flush discipline is inconsistent. In serverless environments, unflushed events may be dropped when the function exits. This is a known risk with `@sentry/nextjs` in serverless unless `Sentry.flush()` is called explicitly.

---

## 5. `writeCronHeartbeat` Coverage

`writeCronHeartbeat` writes a best-effort upsert to the `cron_heartbeats` Supabase table. It is a secondary observability mechanism independent of Sentry.

### Frontend handlers with heartbeat coverage

| Handler | Heartbeat on all paths |
|---|---|
| `check-signals` | ✅ (fixed in Signal Visibility Correction — now called on all 4 exit paths) |
| `generate-brief` | ❌ — heartbeat present on happy path only; error path exits without heartbeat |
| `update-momentum` | not audited (may or may not use heartbeat) |
| `strategic-analysis` | not audited |
| `update-positioning` | not audited |

**`generate-brief` gap:** the handler calls `writeCronHeartbeat` at the end of the happy path but does not call it in the catch block. A failed brief generation will produce neither a heartbeat update nor a Sentry flush — the failure is observable only via `captureException` if the exception is captured before the function exits.

---

## 6. Health Endpoint

`api/health.ts` provides pull-only system health assessment.

**What it measures:**
- Latest fetch age vs. SLA threshold
- Snapshot/diff/signal backlogs (oldest unprocessed rows)
- Stuck signals (pending signals older than threshold)
- Suppression ratio (noiseDiffRatioLast24h ≥ 0.90 with ≥10 diffs)
- Fetch backlog by page_class (high_value / standard / ambient)

**What it does with findings:**
- Emits `Sentry.captureMessage` for each SLA breach or anomaly detected
- Returns a structured JSON response with `ok` (execution health) and `healthy` (system health) fields

**Critical limitation:** the health endpoint is **not scheduled as a cron job**. It requires `Authorization: Bearer {CRON_SECRET}` and must be called manually or from an external monitor. If no one calls it, pipeline backlogs and stuck signals go undetected indefinitely.

**Not wrapped in `withSentry`.** The health endpoint has its own try/catch but does not use the `withSentry` wrapper. An unhandled exception in the health check itself will not be captured.

---

## 7. `pipeline_events` and Alerting

`lib/pipeline-metrics.ts` provides `recordEvent()`, which writes fire-and-forget audit records to the `pipeline_events` table.

**Coverage:** used in fetch-snapshots, extract-sections, detect-diffs, detect-signals, interpret-signals, and pool handlers.

**Alerting path:** none. `pipeline_events` is a pure audit log — a post-hoc debugging aid. No automated process reads it to fire alerts or Sentry events.

**Verdict:** valuable for forensics, not for real-time detection. A stage that consistently writes error events to `pipeline_events` will not trigger any notification.

---

## 8. Timeout and Wall Clock Guard Coverage

**Vercel function timeout configuration:**
- No `maxDuration` exports found in any handler file
- No `functions` overrides in `vercel.json` (runtime) or `radar-ui/vercel.json`
- All handlers run under the default Vercel plan timeout for their project tier

**Wall clock self-termination:**
- `interpret-signals`: has `WALL_CLOCK_GUARD_MS = 25_000` — the only handler with explicit self-termination logic. Stops processing before Vercel kills the function to allow a clean flush and response.
- All other handlers: no wall clock guard. If a handler approaches the Vercel timeout limit, it will be killed hard — `Sentry.flush()` may not complete, and the check-in `status: "ok"` will not be sent. Sentry will see the check-in open and never closed, eventually triggering a missed check-in alert (if alert rules are configured in the Sentry dashboard).

---

## 9. Observability Summary: Active vs. Passive

| Mechanism | Mode | Alert path | Notes |
|---|---|---|---|
| Runtime `withSentry` exception capture | Active | Sentry → alerts if configured | Covers all 20 runtime handlers |
| Runtime `captureCheckIn` monitors | Active | Sentry missed check-in → alert | All 20 runtime crons covered |
| Frontend exception capture (`captureException`) | Active | Sentry → alerts if configured | All 5 frontend crons have it |
| Frontend `captureCheckIn` monitors | Active | Sentry missed check-in → alert | Only `generate-brief` covered (4/5 missing) |
| `cron_heartbeats` table | Passive | No alert — read-only table | Best-effort, not consumed by anything alerting |
| `pipeline_events` table | Passive | No alert — forensic log only | 90-day retention |
| `api/health.ts` Sentry warnings | Passive (pull) | Only fires when endpoint is called | Not scheduled; no external probe confirmed |
| Sentry alert rules | Unknown | Cannot be verified from codebase | No `.sentryclirc`, no `sentry.properties`, no webhook refs |

**The system is largely passive.** It captures errors reliably when they happen and a flush completes. It does NOT proactively detect:
- Frontend cron misfires (no check-in monitors on 4/5 frontend crons)
- Pipeline backlogs (health endpoint must be called manually)
- Slow degradation (nothing monitors pipeline throughput over time)
- Sentry flush failures in frontend handlers

Whether the operator receives real-time alerts for captured exceptions depends entirely on alert rules configured in the Sentry dashboard, which cannot be verified from the codebase.

---

## 10. Known Defects and Gaps

### DEF-01: SENTRY_DNS typo fallback (both surfaces)

**Risk:** If `SENTRY_DSN` is absent or misspelled in the Vercel environment, both surfaces silently fall back to `SENTRY_DNS`. This means a misconfigured env var goes undetected — Sentry will appear to initialize but events may go to the wrong project or nowhere.

**Severity:** Low — the fallback is an active mitigation that makes the current typo work. The risk is forward: if the env var is corrected to `SENTRY_DSN` and `SENTRY_DNS` is removed, the fallback stops working.

**Location:** `lib/sentry.ts:3`, `radar-ui/lib/sentry.ts:8`

---

### DEF-02: 4 frontend crons have no Sentry check-in monitor

**Affected handlers:** `check-signals`, `update-momentum`, `strategic-analysis`, `update-positioning`

**Risk:** A cron misfire (Vercel platform issue, deployment gap, handler crash before `captureException`) will not be detected by Sentry. These handlers run hourly and daily and are responsible for alert generation, momentum scoring, and market positioning — all user-visible.

**Severity:** Medium. These are not pipeline stages (the runtime pipeline has full coverage), but they control the user's view of intelligence freshness and alert delivery.

**Fix scope:** Add `captureCheckIn` to each handler's start/end/error paths. Requires `require("@sentry/nextjs")` workaround (same pattern as `generate-brief`) since the lazy-init frontend module does not export `captureCheckIn`.

---

### DEF-03: Frontend cron flush discipline is inconsistent

**Affected handlers:** `check-signals`, `update-momentum`, `strategic-analysis`, `update-positioning`

**Risk:** Captured exceptions in these handlers may be dropped when the serverless function exits before Sentry can flush the event queue.

**Severity:** Low-Medium. Errors are captured, but delivery is not guaranteed.

**Fix scope:** Add `await Sentry.flush(2000)` in all catch blocks before returning.

---

### DEF-04: `generate-brief` heartbeat not written on error path

**Risk:** A failed brief generation will not update `cron_heartbeats`. The heartbeat timestamp will show the last *successful* run — masking the failure to any operator watching the table.

**Severity:** Low. `cron_heartbeats` is not currently consumed by any alerting mechanism. The impact is limited to manual inspection latency.

**Fix scope:** Add `writeCronHeartbeat("generate-brief")` in the catch block before re-throwing or returning.

---

### DEF-05: `api/health.ts` is pull-only and not wrapped in `withSentry`

**Risk:** The most comprehensive system health check in the codebase is passive — it fires Sentry warnings only when called. An extended pipeline degradation between manual health checks goes undetected.

**Severity:** Medium. This is a structural gap: the health check exists and is accurate, but it only runs when someone pokes it.

**Fix scope (option A):** Add `health` to `vercel.json` as a scheduled cron (e.g., every 6 hours).
**Fix scope (option B):** Configure an external uptime monitor (e.g., BetterUptime, Cronitor, or a Sentry Cron) to hit `/api/health` on a schedule and alert on non-200 or `healthy: false`.

---

### DEF-06: Frontend Sentry missing environment and release tracking

**Risk:** Errors captured on the frontend cannot be filtered or pinged to a specific deployment or environment in Sentry. Post-deploy regression tracking is manual.

**Severity:** Low. The system is operated by one engineer who knows the deployment timeline. The impact is forensic latency, not operational risk.

**Fix scope:** Add `environment` and `release` to the frontend Sentry init using `process.env.VERCEL_ENV` and `process.env.VERCEL_GIT_COMMIT_SHA`.

---

### DEF-07: No wall clock guard outside `interpret-signals`

**Risk:** Any handler with a variable-length loop (e.g., `detect-movements`, `synthesize-movement-narratives`, `generate-radar-narratives`) can be killed hard by Vercel before completing a flush. The Sentry check-in will remain open, eventually triggering a missed check-in alert — but the error context (what stage it was in, how many items it processed) will be lost.

**Severity:** Low. The check-in model will detect the issue; the gap is only in diagnostic detail.

**Fix scope:** Extend `WALL_CLOCK_GUARD_MS` pattern to any handler that iterates over a variable-length competitor list.

---

## 11. Recommendations (Priority Order)

| Priority | Defect | Action |
|---|---|---|
| P1 | DEF-02 | Add `captureCheckIn` to `check-signals`, `update-momentum`, `strategic-analysis`, `update-positioning` |
| P1 | DEF-05 | Schedule `api/health.ts` as a cron or configure an external probe |
| P2 | DEF-03 | Add `Sentry.flush(2000)` to frontend cron catch blocks |
| P2 | DEF-04 | Add `writeCronHeartbeat` to `generate-brief` error path |
| P3 | DEF-06 | Add `environment` and `release` to frontend Sentry init |
| P3 | DEF-07 | Extend wall clock guard to variable-length runtime handlers |
| P4 | DEF-01 | Standardize on `SENTRY_DSN`; document the `SENTRY_DNS` fallback in env setup notes |

---

*This audit covers the state of the codebase as of 2026-03-17. Alert rules configured in the Sentry dashboard cannot be verified from the codebase and are outside the scope of this report.*
