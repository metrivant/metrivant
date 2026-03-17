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
- error path handled?
- wrapped in try/catch?
- monitor slug defined?

Record:

- monitor slug names

Important:

From code you can verify:
- check-in usage
- slug definition

From code you CANNOT verify:
- whether the monitor exists in Sentry UI

→ flag clearly:

"Monitor existence must be verified in Sentry UI"

Classify each handler:

- full coverage
- partial coverage
- no coverage

Also identify:

- handlers that may terminate before completion check-in
- long-running jobs vs timeout risk

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

Check:

- Sentry.captureException present?
- try/catch coverage
- silent failure paths

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

- explicit guards (e.g. 25s wall-clock)
- OpenAI timeout configs
- concurrency / batch size

For each high-risk handler:

Report:

- max execution path (seconds)
- function timeout (seconds)
- gap (timeout - execution)

Classify:

- safe
- risk
- unknown

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

A. pipeline stall
B. cron not firing
C. cron fails silently
D. AI degradation
E. fetch failure spike
F. signal blockage
G. interpretation drop
H. brief generation failure
I. feed ingestion producing zero results
J. data correctness failure (handler succeeds, output wrong)

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

Acceptable:

- documented non-critical degradations (e.g. velocity no-op)

System fails if:

- any critical stage can fail silently
- detection exists but does not notify operator

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
