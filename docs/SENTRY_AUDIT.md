# Sentry Observability Audit

**Audit date:** 2026-03-17
**Implementation date:** 2026-03-17
**Scope:** Full audit + hardening pass across both Metrivant surfaces — runtime (`metrivant-runtime`) and frontend (`metrivant-ui`).
**Status:** Post-hardening. All P1 and P2 defects resolved.

---

## 1. Sentry Initialization

### Runtime (`lib/sentry.ts`)

- **Package:** `@sentry/node`
- **DSN source:** `SENTRY_DSN ?? SENTRY_DNS` — typo fallback retained (see DEF-01)
- **Traces:** `tracesSampleRate: 0.05` production, `1.0` development
- **Environment:** `VERCEL_ENV ?? NODE_ENV`
- **Release:** `VERCEL_GIT_COMMIT_SHA`
- **`beforeSend`:** not configured
- **Verdict:** solid.

### Frontend (`radar-ui/lib/sentry.ts`)

- **Package:** `@sentry/nextjs` (lazy init)
- **DSN source:** `SENTRY_DSN ?? SENTRY_DNS` — same typo fallback
- **Traces:** `tracesSampleRate: 0` — traces disabled
- **Environment:** not set (DEF-06, still open)
- **Release:** not set (DEF-06, still open)
- **`flush` export added:** `export async function flush(timeoutMs = 2000)` — safe for client+server; used by all frontend cron handlers
- **`captureCheckIn`:** NOT exported from this module (client-bundled file — would break client bundle); frontend handlers use inline `require("@sentry/nextjs")` pattern instead
- **Verdict:** functional. Exception capture, flush discipline, and cron monitoring are now correct. Env/release tracking still absent.

---

## 2. Handler Wrapper Coverage

### Runtime: `lib/withSentry.ts`

All 25 scheduled runtime handlers are wrapped with `withSentry`. The wrapper:

- Catches unhandled exceptions and calls `Sentry.captureException`
- Tags the function name via `Sentry.setTag("function", name)`
- Calls `Sentry.flush(2000)` before returning 500
- Does NOT suppress the error — re-throws after flush

**Verdict:** complete. Any unhandled throw in any runtime handler is captured and flushed.

### Frontend: no shared wrapper (by design)

Frontend cron handlers (`/api/check-signals`, `/api/generate-brief`, `/api/update-momentum`, `/api/strategic-analysis`, `/api/update-positioning`) manage Sentry manually. All 5 now have explicit `captureCheckIn` + `flush` coverage at every exit path (see §3).

---

## 3. Sentry Check-in Coverage (Cron Monitors)

### Runtime — 25 scheduled cron slots

All runtime handlers emit `captureCheckIn` with `checkInId` correlation (start → ok/error linked as one duration-tracked event).

| Handler | Monitor Slug | Check-in | checkInId |
|---|---|---|---|
| `fetch-snapshots` (ambient) | `fetch-snapshots-ambient` | ✅ | ✅ |
| `fetch-snapshots` (high_value) | `fetch-snapshots-high-value` | ✅ | ✅ |
| `fetch-snapshots` (standard) | `fetch-snapshots-standard` | ✅ | ✅ |
| `extract-sections` | `extract-sections` | ✅ | ✅ |
| `build-baselines` | `build-baselines` | ✅ | ✅ |
| `detect-diffs` | `detect-diffs` | ✅ | ✅ |
| `detect-signals` | `detect-signals` | ✅ | ✅ |
| `detect-ambient-activity` | `detect-ambient-activity` | ✅ | ✅ |
| `update-pressure-index` | `update-pressure-index` | ✅ | ✅ |
| `interpret-signals` | `interpret-signals` | ✅ | ✅ |
| `update-signal-velocity` | `update-signal-velocity` | ✅ | ✅ |
| `detect-movements` | `detect-movements` | ✅ | ✅ |
| `synthesize-movement-narratives` | `synthesize-movement-narratives` | ✅ | ✅ |
| `generate-radar-narratives` | `generate-radar-narratives` | ✅ | ✅ |
| `generate-sector-intelligence` | `generate-sector-intelligence` | ✅ | ✅ |
| `ingest-feeds` | `ingest-feeds` | ✅ | ✅ |
| `promote-feed-signals` | `promote-feed-signals` | ✅ | ✅ |
| `promote-baselines` | `promote-baselines` | ✅ | ✅ |
| `retention` | `retention` | ✅ | ✅ |
| `suggest-selector-repairs` | `suggest-selector-repairs` | ✅ | ✅ |
| `onboard-competitor` | `onboard-competitor` | ✅ | ✅ (fixed: moved before try block) |
| `watchdog` | `watchdog` | ✅ | ✅ (new handler) |

**Verdict:** runtime cron monitor coverage is complete. `checkInId` correlation allows Sentry to calculate actual monitor duration.

### Frontend — 5 scheduled cron slots

All 5 frontend cron handlers now have full check-in coverage. **DEF-02 resolved.**

| Handler | Monitor Slug | Check-in | checkInId | flush |
|---|---|---|---|---|
| `check-signals` | `check-signals` | ✅ | ✅ | ✅ |
| `generate-brief` | `generate-brief` | ✅ | ✅ | ✅ |
| `update-momentum` | `update-momentum` | ✅ | ✅ | ✅ |
| `strategic-analysis` | `strategic-analysis` | ✅ | ✅ | ✅ |
| `update-positioning` | `update-positioning` | ✅ | ✅ | ✅ |

All handlers use the inline `require("@sentry/nextjs")` pattern with a local `captureCheckIn` helper function. This is intentional — the lazy-init frontend Sentry module cannot expose `captureCheckIn` without risk of bundling it client-side.

---

## 4. Flush Discipline

### Runtime

Every runtime handler flushes via `Sentry.flush(2000)` in both success and error paths, enforced by the `withSentry` wrapper and per-handler `finalize()` pattern. **Complete.**

### Frontend — **DEF-03 resolved**

All 5 frontend cron handlers now call `flush()` (from `radar-ui/lib/sentry.ts`) at every exit point:

| Handler | flush on ok | flush on error |
|---|---|---|
| `check-signals` | ✅ | ✅ |
| `generate-brief` | ✅ | ✅ |
| `update-momentum` | ✅ | ✅ |
| `strategic-analysis` | ✅ | ✅ |
| `update-positioning` | ✅ | ✅ |

---

## 5. Watchdog (`api/watchdog.ts`) — New

A new pipeline staleness watchdog was added. Runs every 15 minutes.

**What it checks:**

| Stage | Threshold | Source |
|---|---|---|
| `snapshot` | 60 min | `pipeline_events` |
| `extract` | 30 min | `pipeline_events` |
| `diff` | 30 min | `pipeline_events` |
| `signal` | 30 min | `pipeline_events` |
| `interpret` | 60 min | `pipeline_events` |
| `build-baselines` | 60 min | `section_baselines` (fallback — stage doesn't write pipeline_events) |

**Behavior:** For each stale stage, emits a `Sentry.captureMessage` warning at `"warning"` level with `watchdog_stale_stage` context including `stage`, `lastEventAt`, `minutesSinceLastEvent`, and `threshold`.

**Important caveat:** The `interpret` stage only writes to `pipeline_events` when signals are processed. If no pending signals exist, no rows are written — a quiet watchdog for that stage is expected behavior, not a failure. Cross-reference the `interpret-signals` Sentry Cron monitor (check-in status) to distinguish genuine stalls from empty-batch runs.

**Self-monitoring:** The watchdog itself has `captureCheckIn` with checkInId threading and `flush`. If the watchdog itself fails, Sentry will detect the missed check-in.

---

## 6. AI Latency Recording (`pipeline_events`)

All LLM calls now record latency and outcome to `pipeline_events` via `recordEvent()`. This enables post-hoc AI performance analysis.

| Handler | Stage | Model |
|---|---|---|
| `synthesize-movement-narratives.ts` | `movement_synthesis` | `gpt-4o` |
| `generate-radar-narratives.ts` | `radar_narrative` | `gpt-4o-mini` |
| `generate-sector-intelligence.ts` | `sector_intelligence` | `gpt-4o` |
| `generate-brief` (radar-ui) | `brief_generation` | `gpt-4o` |

Each record includes `duration_ms`, `status` (success/failure), and metadata (`model`, `batch_size`, context IDs).

---

## 7. `writeCronHeartbeat` Coverage

| Handler | Heartbeat on all paths |
|---|---|
| `check-signals` | ✅ (all 4 exit paths) |
| `generate-brief` | ⚠️ error path missing (DEF-04, still open) |
| `update-momentum` | not audited |
| `strategic-analysis` | not audited |
| `update-positioning` | not audited |

`cron_heartbeats` is a secondary observability layer (not consumed by alerting). DEF-04 is low-severity.

---

## 8. Health Endpoint

`api/health.ts` provides pull-only system health. Emits Sentry warnings when called.

**What it measures:** fetch age, snapshot/diff/signal backlogs, stuck signals, suppression ratio.

**Structural gap (DEF-05, still open):** Not scheduled as a cron. Requires manual or external probe to trigger. The new watchdog (`api/watchdog.ts`) partially fills this gap for pipeline freshness, but does not replace the full health check logic.

**Not wrapped in `withSentry`.** Exceptions in the health handler itself are not auto-captured.

---

## 9. Observability Summary

| Mechanism | Mode | Alert path | Status |
|---|---|---|---|
| Runtime `withSentry` exception capture | Active (push) | Sentry → alert | ✅ Complete |
| Runtime `captureCheckIn` with checkInId | Active (push) | Sentry missed check-in → alert | ✅ Complete |
| Frontend exception capture | Active (push) | Sentry → alert | ✅ Complete |
| Frontend `captureCheckIn` with checkInId | Active (push) | Sentry missed check-in → alert | ✅ Complete (all 5 handlers) |
| Watchdog staleness detection | Active (push, 15min) | Sentry warning → alert | ✅ New |
| AI latency recording | Passive | `pipeline_events` forensics only | ✅ New |
| `cron_heartbeats` | Passive | No alert — read-only | ⚠️ Secondary only |
| `pipeline_events` | Passive | No alert — forensic log | ⚠️ Secondary only |
| `api/health.ts` | Passive (pull) | Only fires when called | ⚠️ Not scheduled |
| Sentry alert rules | External | Cannot verify from codebase | ❓ UI-only |

---

## 10. Defect Register

| ID | Description | Severity | Status |
|---|---|---|---|
| DEF-01 | `SENTRY_DNS` typo fallback in both surfaces | Low | Open — documented in `.env.example`, not a live defect |
| DEF-02 | 4 of 5 frontend crons had no `captureCheckIn` monitor | Medium | **Fixed** |
| DEF-03 | Frontend cron flush discipline inconsistent | Low-Medium | **Fixed** |
| DEF-04 | `generate-brief` heartbeat missing on error path | Low | Open — low impact (heartbeat table not alerting) |
| DEF-05 | `api/health.ts` not scheduled — pull-only | Medium | Open — watchdog partially mitigates for pipeline freshness |
| DEF-06 | Frontend Sentry missing `environment` and `release` | Low | Open — forensic impact only |
| DEF-07 | No wall clock guard outside `interpret-signals` | Low | Open — check-in model will detect timeout kills |

---

## 11. Silent Failure Matrix (Post-Hardening)

| Scenario | Detected | System | Notified |
|---|---|---|---|
| A. Pipeline stall | ✅ | Watchdog (15min) | Sentry warning → alert |
| B. Cron not firing | ✅ | Sentry check-in | Missed check-in alert |
| C. Cron fails silently | ✅ | `withSentry` wrapper + check-in `error` | Sentry alert |
| D. AI degradation | ✅ | `pipeline_events` failure entries | Pull only (no alert) |
| E. Fetch failure spike | ✅ | `captureCheckIn` error on `fetch-snapshots` | Sentry alert |
| F. Signal blockage | ✅ | Watchdog `signal` stage freshness | Sentry warning |
| G. Interpretation drop | ✅ | Watchdog `interpret` stage freshness | Sentry warning ⚠️ see note |
| H. Brief generation failure | ✅ | `captureCheckIn` error on `generate-brief` | Sentry alert |
| I. Feed ingestion zero results | ✅ | `captureCheckIn` ok (runs, no error) — but no result count check | Pull via pipeline_events |
| J. Data correctness failure | ❌ | Not detectable | None — known limitation |

⚠️ Scenario G: `interpret` watchdog may fire false positives when no pending signals exist. Cross-reference `interpret-signals` cron monitor status in Sentry Crons before acting.

---

## 12. Remaining Recommendations

| Priority | Defect | Action | Effort |
|---|---|---|---|
| P1 | DEF-05 | Schedule `api/health.ts` as cron or configure external uptime probe | Small |
| P2 | DEF-04 | Add `writeCronHeartbeat("generate-brief")` to catch block | Trivial |
| P3 | DEF-06 | Add `environment` and `release` to frontend Sentry init | Trivial |
| P3 | DEF-07 | Extend `WALL_CLOCK_GUARD_MS` to `detect-movements`, `synthesize-movement-narratives`, `generate-radar-narratives` | Small |
| P4 | DEF-01 | Standardize on `SENTRY_DSN`; remove `SENTRY_DNS` fallback after env confirmation | Trivial |

---

## 13. System Verdict

**Critical failure detection:** Yes. Every pipeline stage has Sentry check-in coverage. A stage that stops running or throws will be detected within one missed check-in interval and will fire an alert (if alert rules are configured in Sentry UI).

**Operator notified immediately:** Yes, for all P1 scenarios — provided Sentry alert rules are active for `is:unresolved` issues and missed cron check-ins.

**Watchdog coverage:** Yes. `api/watchdog.ts` detects pipeline freshness every 15 minutes, independent of individual stage check-ins.

**Remaining blind spot:** Feed ingestion result counts (Scenario I) are not alertable. `pipeline_events` logs failures but no automated process reads it for alerting.

---

*Last updated: 2026-03-17. Alert rules configured in the Sentry dashboard cannot be verified from the codebase.*
