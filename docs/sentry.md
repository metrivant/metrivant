Purpose:
Provide a repeatable, read-only audit of Sentry coverage and observability health.

This protocol diagnoses the current state.
It does NOT implement fixes.

---

## OBJECTIVE

Determine:

- what Sentry observes
- what it misses
- whether failures are both detected AND surfaced

Core question:

Would a critical failure be detected AND brought to operator attention immediately?

---

## RULES

DO NOT:

- modify code
- change Sentry configuration
- add monitors or alerts
- change environment variables

ONLY:

- inspect
- classify
- report

---

## AUDIT METADATA

Include at top of every run:

- audit_date: YYYY-MM-DD
- surfaces_checked: runtime / frontend
- access_level: code-only / partial / full
- confidence: high / medium / low

---

## EXECUTION ORDER (optimised)

Run phases in this order for maximum leverage per token:

1. **Phase 8** (silent failure matrix) — immediately identifies what's broken
2. **Phase 5** (timeout analysis) — identifies handlers at risk of hard timeout
3. **Phase 3** (cron monitor coverage) — bulk audit, delegate to agent
4. **Phase 4** (error capture paths) — delegate to agent
5. **Phases 0–2** (init, filtering, surface) — quick validation of root causes

Parallelise: Phase 3 + 4 + 5 as independent agents. Phase 0–2 inline (fast).

---

## BASELINE (2026-03-20 audit)

### SDK versions
- @sentry/node ^10.42.0 (runtime) — current
- @sentry/nextjs ^10.43.0 (frontend) — current
- Cron check-ins: supported (since v7.x)

### Initialization
- Runtime: lib/sentry.ts — getClient() guard, DSN from SENTRY_DSN/SENTRY_DNS, tracesSampleRate 0.05 prod
- Frontend: radar-ui/lib/sentry.ts — lazy init wrapper, getClient() guard, tracesSampleRate 0
- Frontend configs: sentry.server.config.ts, sentry.edge.config.ts, sentry.client.config.ts — all correct
- No beforeSend, no event processors — no valid errors are dropped
- Classification: **correct, no filtering risk**

### Cron monitor coverage (42 handlers)
- Full coverage: 27 (start + linked ok + linked error + try/catch)
- Partial coverage: 15 (missing checkInId linkage or missing error path)
- No coverage: 0

### Error capture coverage (20 critical handlers)
- Covered: 14 (detect-diffs, detect-signals, all 6 ingest handlers, all 6 promote handlers)
- Partial: 6 (fetch-snapshots, extract-sections, interpret-signals, generate-radar-narratives, check-signals, generate-brief)

### Timeout risk
- Safe: 31 handlers (DB-only or budget-guarded)
- Risk: 6 handlers (OpenAI + no wall-clock guard)
- High risk: 5 handlers (sequential OpenAI loops, no guard)

---

## KNOWN DEFECT PATTERNS

### 1. Orphaned check-ins (checkInId not passed to completion)

**Pattern:** Handler calls `captureCheckIn({status:'in_progress'})`, stores `checkInId`, but never passes it to the ok/error check-in. Sentry creates orphaned records instead of linking start→completion.

**Fix pattern:** Pass `checkInId` to completion check-in:
```ts
Sentry.captureCheckIn({ checkInId, monitorSlug: 'slug', status: 'ok' });
```

### 2. Missing error-path check-in (radar-ui handlers)

**Pattern:** Handler starts check-in, has per-item try/catch inside a loop, but no outer try/catch wrapping the entire body. Unhandled throw from org query or code outside the loop leaves monitor stuck in `in_progress` forever.

**Fix pattern:** Wrap entire post-start body in try/catch, fire error check-in in catch.

### 3. Early return without check-in

**Pattern:** Handler starts check-in, hits an early return (no orgs, no data), returns without firing completion check-in. Monitor stuck in `in_progress`.

**Fix pattern:** Fire ok check-in before early return.

### 4. Silent catch blocks

**Pattern:** Non-fatal enrichment/artifact queries wrapped in `catch { /* non-fatal */ }` with no Sentry visibility. Chronic failures produce degraded output (empty briefs, low-quality interpretations) with zero alerting.

**Fix pattern:** Add `Sentry.captureMessage('name', 'warning')` inside silent catches for queries that feed critical outputs.

### 5. Missing wall-clock guard on OpenAI loops

**Pattern:** Handler loops over items making sequential OpenAI calls. No `Date.now() - startedAt` check. If GPT latency spikes, handler exceeds maxDuration and hard-times-out (Vercel kills the process — no error check-in fires, no Sentry event).

**Fix pattern:** Add wall-clock guard at top of each loop iteration:
```ts
const WALL_CLOCK_GUARD_MS = (maxDuration - 5) * 1000; // 5s safety margin
if (Date.now() - startedAt > WALL_CLOCK_GUARD_MS) { break; }
```
Existing example: `api/interpret-signals.ts` (WALL_CLOCK_GUARD_MS=25000).

---

## SILENT FAILURE MATRIX (severity-weighted)

| # | Scenario | Severity | Detected | System | Notification |
|---|---|---|---|---|---|
| A | Pipeline stall | **CRITICAL** | yes | health + watchdog + sentry | alert (watchdog) |
| B | Cron not firing | **CRITICAL** | yes | sentry cron monitors | alert (if Sentry alert rule exists) |
| C | Cron fails silently | **HIGH** | partial | sentry (if check-in linked correctly) | alert (if linked) |
| D | AI degradation (slow GPT) | **HIGH** | partial | hard timeout kills process silently | none (no wall-clock guard) |
| E | Fetch failure spike | **HIGH** | yes | health + pipeline_events + sentry | pull (health) + alert (sentry) |
| F | Signal blockage | **HIGH** | yes | health (stuckSignals) + sentry | pull (health) |
| G | Interpretation drop | **MEDIUM** | yes | health + pipeline_events | pull (health) |
| H | Brief generation failure | **MEDIUM** | partial | sentry cron monitor | alert (monitor only, silent artifact failures) |
| I | Feed ingestion zero results | **LOW** | yes | sentry captureMessage | alert (warning level) |
| J | Data correctness failure | **LOW** | no | none | none (known limitation) |

---

## PHASE 0 — ACCESS & VERSION CHECK

Determine:

- access to codebase (always)
- access to env/config
- access to Sentry UI (likely no)

Check versions:

- @sentry/node (runtime)
- @sentry/nextjs (frontend)

Report:

- versions
- whether materially outdated

Important:

If SDK version predates required features (e.g. cron check-ins),
→ downstream phases must be interpreted accordingly.

If UI not accessible:

→ state explicitly:

"Sentry alert configuration cannot be verified from codebase"

---

## PHASE 1 — INITIALIZATION & FILTERING

Inspect:

- runtime: lib/sentry.ts
- frontend: radar-ui/lib/sentry.ts
- sentry.client/server/edge configs
- next.config.js
- instrumentation files

Check:

- DSN source (SENTRY_DSN vs SENTRY_DNS)
- initialization guards (no duplicate init)
- environment tagging
- tracesSampleRate
- integrations

Critically inspect:

- beforeSend
- beforeBreadcrumb
- event processors

Determine:

- are events filtered or suppressed?
- could valid errors be dropped before reaching Sentry?

Classify:

- correct
- partial
- misconfigured
- inconsistent across surfaces

---

## PHASE 2 — SURFACE COVERAGE

Surfaces:

- runtime (API + cron)
- frontend (Next.js)

Check:

- Sentry initialized on both
- any missing surface coverage

Output:

surface → covered / not covered

---

## PHASE 3 — CRON MONITOR COVERAGE

List all cron handlers.

For each:

- start check-in present?
- completion check-in present?
- **completion check-in passes checkInId?** (critical — orphaned if missing)
- error path handled?
- wrapped in try/catch?
- monitor slug defined?

Record:

- monitor slug names

Important:

From code you can verify:
- check-in usage
- slug definition
- checkInId linkage

From code you CANNOT verify:
- whether the monitor exists in Sentry UI

→ flag clearly:

"Monitor existence must be verified in Sentry UI"

Classify each handler:

- full coverage (start + linked ok + linked error + try/catch)
- partial coverage (missing any of the above)
- no coverage

Also identify:

- handlers that may terminate before completion check-in
- long-running jobs vs timeout risk
- early returns after start check-in without completion check-in

---

## PHASE 4 — ERROR CAPTURE PATHS

For each critical stage:

- fetch
- extract
- diff
- signals
- interpretation
- narrative generation
- alerts
- brief generation
- feed ingestion (all 6 pools)
- signal promotion (all 6 pools)

Check:

- Sentry.captureException present?
- try/catch coverage
- silent failure paths (catch blocks that swallow without Sentry)
- **silent artifact/enrichment catches** (catch blocks on queries feeding critical outputs)

Output:

stage → covered / partial / silent risk

---

## PHASE 5 — TIMEOUT ANALYSIS (NUMERIC)

Inspect:

- vercel.json (maxDuration)
- function config exports

Extract:

- actual timeout values (seconds)

From handler code:

- explicit wall-clock guards (WALL_CLOCK_GUARD_MS pattern)
- OpenAI timeout configs
- concurrency / batch size
- sequential vs parallel loop structure

For each handler with OpenAI calls:

Report:

- max execution path (seconds)
- function timeout (seconds)
- wall-clock guard present: yes/no
- gap (timeout - execution)

Classify:

- safe (guard present OR no external calls)
- risk (OpenAI + no guard + maxDuration >= 60s)
- high risk (sequential OpenAI loop + no guard + maxDuration >= 90s)

---

## PHASE 6 — ALERTING VISIBILITY

From code:

Check:

- alert integrations (email, webhook, Slack)
- sentry.properties / .sentryclirc

Also confirm:

- event filtering (beforeSend etc.) does not suppress critical errors

If alerting not visible:

→ state:

"Alerting configured outside code (Sentry UI) or not configured"

Answer explicitly:

If a cron monitor fails, is the operator notified?

- yes
- no
- unknown

---

## PHASE 7 — SYSTEM BOUNDARY ANALYSIS

Compare:

- Sentry
- pipeline_events
- /api/health

Reference model:

Sentry = alerting (push)
pipeline_events = audit trail (post-incident)
/api/health = dashboard (pull)

Classify current state:

- aligned
- overlapping
- fragmented

Flag:

- failures only visible in pipeline_events (no alert)
- health signals not connected to alerting
- duplicated responsibilities

---

## PHASE 8 — SILENT FAILURE MATRIX

Evaluate detection + notification for:

A. pipeline stall (CRITICAL)
B. cron not firing (CRITICAL)
C. cron fails silently (HIGH)
D. AI degradation / slow GPT (HIGH)
E. fetch failure spike (HIGH)
F. signal blockage (HIGH)
G. interpretation drop (MEDIUM)
H. brief generation failure (MEDIUM)
I. feed ingestion producing zero results (LOW)
J. data correctness failure (LOW — known limitation)

For each:

- detected: yes / partial / no
- detection system: sentry / pipeline_events / health / none
- notification: alert / pull / none

Important:

Item J is expected to be undetected.
This is a known observability limitation.

---

## PHASE 9 — CLASSIFICATION SUMMARY

Summarize system into:

- covered well
- instrumented but not operationalized
- missing instrumentation
- missing alerting
- false-noise risk

---

## PHASE 10 — PRIORITY GAPS (BY DETECTION LATENCY)

Rank issues by:

Critical:
→ operator unaware for >12 hours

High:
→ detectable only via manual inspection

Medium:
→ detected but delayed/suboptimal

For each:

- gap
- consequence
- severity
- fix category (config / code / architecture)
- effort (trivial / small / medium)

DO NOT implement fixes.

---

## FINAL CHECK

System passes if:

- critical failures (fetch → interpretation) are detectable
- weekly outputs (briefs, sector intelligence) are monitored
- detection leads to notification (not just logging)
- **OpenAI-calling handlers have wall-clock guards** (added 2026-03-20)
- **all check-ins pass checkInId** (added 2026-03-20)

Acceptable:

- documented non-critical degradations (e.g. velocity no-op)

System fails if:

- any critical stage can fail silently
- detection exists but does not notify operator
- **any handler can hard-timeout without error check-in** (added 2026-03-20)

---

## OUTPUT FORMAT

Return:

1. Coverage summary
2. Most critical gap
3. Top 5 issues
4. Answer:

"Would a critical failure be detected AND surfaced immediately?"

5. Confidence level
6. Audit date

---

## HANDOFF

This protocol = diagnosis

Findings feed into:

→ Sentry strategy prompt (design + implementation of improvements)

---

## CORE STANDARD

If the system fails at 2am:

- do you know immediately?

If not:

→ observability is insufficient
