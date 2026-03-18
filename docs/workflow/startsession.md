# SESSION BOOTSTRAP

Read at start of every session.

Reading order: ORIENTATION → GUARD RAILS → BEHAVIOUR → EXECUTION → REFERENCE → BOOKENDS

---

## 1. SYSTEM IDENTITY (ENFORCED)

Metrivant = deterministic competitive intelligence system.

Do NOT:
- redesign architecture unless explicitly directed
- widen scope implicitly
- introduce speculative systems

If architecture change is explicitly requested:
→ mandatory impact analysis across:
  - surfaces
  - deployment
  - pipeline
  - shared contracts
→ propose changes + consequences before implementing

---

## 2. SURFACES & DEPLOYMENT (HARD BOUNDARY)

Runtime:
- dirs: api/, lib/, migrations/
- vercel: metrivant-runtime
- deps: root package.json

Frontend:
- dir: radar-ui/
- vercel: metrivant-ui
- deps: radar-ui/package.json

RULE:
Each surface is isolated at build time.
Every import must resolve from its own surface package.json.

Env rule:
Environment variables are surface-specific.
Variables in metrivant-runtime are NOT available in metrivant-ui.

VERIFY:
cat .vercel/project.json
cat radar-ui/.vercel/project.json

Dependency check:
scripts/check-surface-deps.sh (if present)
If missing → manually verify imports vs package.json

---

## 3. SESSION GATE (MANDATORY)

Before any work:

surface: frontend | runtime | both
mode: build | fix | diagnose | refactor | document

If unclear:
STOP — ask

If mode changes mid-session:
→ restate mode
→ re-confirm surface

**MODE INFERENCE** — when mode is not stated explicitly:

| Task description                          | Infer mode  |
|-------------------------------------------|-------------|
| "check", "verify", "look at", "is X ok"  | diagnose    |
| "fix", "it's broken", "not working"       | fix         |
| "add", "build", "implement"               | build       |
| "clean up", "simplify", "improve"         | refactor    |
| "analyse and improve X — nothing showing" | fix         |

State the inferred mode at the start of the session. Stop and ask only if genuinely ambiguous.

**MODE RULES:**

diagnose:
- read-only
- no code changes unless explicitly approved

document:
- no code changes

refactor:
- contract-change gate must be evaluated on every edit

build / fix:
- normal rules apply

---

## 4. GUARD RAILS

### High Blast Radius (shared definition)

High blast radius =
- affects pipeline behavior
- crosses surfaces
- changes deployment behavior
- alters shared contracts
- adds external dependencies
- changes build assumptions

Everything else = low blast radius

### Contract-Change Gate (critical)

If a change affects:
- function signatures used elsewhere
- API request/response shapes
- shared types
- database schema
- env var requirements
- component props used across modules
- deployment/build assumptions

→ state the contract change explicitly
→ state impacted surface(s)
→ if cross-boundary or high blast radius: STOP and request approval

### Stop Conditions (critical)

STOP if:
- surface unclear
- mode unclear
- dependency ownership unclear
- deployment target unclear
- high-risk mismatch detected
- change crosses surfaces unintentionally
- new external dependency introduced without verification

Never guess.

---

## 5. BEHAVIOUR DURING WORK

### Adaptive Refinement (controlled)

If code reality differs from prompt/spec:

1. detect mismatch
2. state:
   - expected behavior
   - current code behavior
3. classify severity

Low-risk mismatch:
- contained within one file
- no change to exports, props, API shapes, database queries, or cross-surface behavior

→ note adjustment briefly, then proceed

High-risk mismatch:
- affects architecture, surfaces, deployment, pipeline, shared contracts, external behavior, or introduces a new pattern

→ STOP
→ propose minimal refinement + impact
→ wait for approval before proceeding

Default rule:
detect → classify → propose if needed → approve if high-risk → execute

Never silently refine architecture or system behavior.

### Opportunistic Improvement (auto-apply)

If a clearly scoped, low-risk, high-leverage improvement or clarification is identified during the session,
implement it immediately without expanding scope.

Criteria for auto-apply (ALL must be true):
- contained within one file or one component
- improves correctness, visibility, or determinism
- no new abstractions, no new systems, no new dependencies
- no change to contracts, exports, API shapes, or cross-surface behavior

If any criterion is uncertain → treat as high-risk mismatch (propose first).

Do NOT use this rule to:
- add features not requested
- refactor working code for style
- introduce new patterns

---

## 6. EXECUTION PROTOCOLS

### Diagnostic Efficiency Protocol

Use this order for diagnose sessions. Stop at the level that answers the question.

```
1. Health endpoint          → system-wide snapshot (fastest, one call)
2. pipeline_events          → which stage is failing and when
3. Targeted SQL             → count/distribution before reading code
4. Code (offset+limit)      → only if SQL doesn't explain the cause
5. git log                  → always check recent commits before concluding
```

Never read source files before checking health + pipeline_events first.
Never use specific column names in REST queries before doing `limit=1&select=*` to learn the schema.

**UI "missing data" triage order:** (2026-03-18)
```
1. Check page.tsx imports + JSX (grep -n "ComponentName" page.tsx) — stale import most common cause
2. Check if source table is populated (REST count query)
3. Check when the populating cron last ran (pipeline_events or Vercel cron logs)
4. If code + data are correct → deployment delay or browser cache (tell user: Ctrl+Shift+R)
```

**Bulk delete order for non-CASCADE tables (competitor cleanup):**
```
1. signal_feedback          (references signals)
2. interpretations          (references signals)
3. signals                  (references section_diffs)
4. section_diffs            (references page_sections)
5. page_sections            (references snapshots)
6. section_baselines        (references monitored_pages)
7. snapshots                (references monitored_pages)
8. monitored_pages          (references competitors)
9. strategic_movements      (references competitors — no CASCADE)
10. tracked_competitors     (references competitors)
11. competitors             (root row)
```
Batch ≤50 IDs per REST call to avoid Supabase 8-second statement timeout (error 57014).

### Token Efficiency Rules — Tool Use

- Parallel tool calls for independent queries — SQL + code read in the same message when not dependent.
- Use `limit=1&select=*` to discover schema before using specific column filters.
- Use `offset+limit` when reading large files — read only the relevant section.
- Read git log before reading code — commit messages often explain "why" and prevent unnecessary file reads.
- Count/distribution queries before full row fetches: confirm scale before fetching all data.
- Stop reading when root cause is confirmed — do not continue for completeness.
- For large components (Radar.tsx, 4000+ lines): `grep -n "pattern"` first → get line numbers → `Read offset+limit` on relevant block only. Never read the full file for a targeted edit. (2026-03-18)
- Multi-file search: `grep -n "pattern" file1 file2 file3 2>/dev/null` in one Bash call. Use when checking imports across 2–4 known files. (2026-03-18)
- When editing a large component, run ALL edits in one message with parallel Edit tool calls where line ranges are independent. Do not interleave reads between edits. (2026-03-18)
- Prefer `timeout 90 git push 2>&1` over background push — synchronous, 1 turn. Pre-push TS checks take ~60s; 90s is sufficient. (2026-03-18)
- Scan discipline: extract only function signatures, key conditions, queries, critical logic paths. Multiple matches → return top 2–3 only. Large files → scan, do not dump.
- Prop threading: when a server component needs to pass live data to a stateless child, compute a typed stats struct in the page and thread it down. Avoids a new API route. Pattern: `page.tsx → Parent({stats}) → Child({stats})`. (2026-03-18)

### Token Efficiency Rules — Response Format

Default bias: **return less, not more**. Output only what changes understanding or unblocks action.

**Task-type defaults:**

| Task | Output |
|---|---|
| Audit / diagnose | findings only → `file:line → fact` |
| Code change | changed lines only (no surrounding context) |
| Debug | cause + fix only |
| "Why?" follow-up | 1–2 sentences max |
| Search / read | top 2–3 matches, not exhaustive list |

**Format rules:**
- Findings: `file:line → fact` — one line each, max 2–3 per file
- Code blocks: max 5 lines, trimmed to the relevant change
- No explanations unless explicitly requested
- No repetition or restating context already in the conversation
- Prefer `file:line` references over quoting code blocks
- Never exceed 20 lines total without operator request

**Prohibited:**
- Long explanations of obvious decisions
- Full file outputs when a reference suffices
- Architecture summaries not requested
- Restating what the user just said
- Verbose reasoning chains — state the conclusion
- Completionist searching (continuing after answer is found)

**Self-check before every response:**
1. Is this minimal?
2. Can it be shorter without losing correctness?
3. If >20 lines → reduce to ≤10

### Prompt Execution Rules

- One step at a time means: do the step, report findings, wait. Do not auto-advance to next step.
- Report findings before proposing fixes. In diagnose mode, findings first, fix proposal second.
- When a fix is approved: state the plan (1–3 lines), list the file(s), implement, type-check, commit, push.
- Do not summarise what was done after a commit — the diff speaks for itself. Skip trailing summaries.
- "pipeline audit" = diagnose mode, both surfaces. Proceed stage-by-stage, one stage per turn.
- "comprehensive report" with open questions = document mode. Generate the report to a file in docs/, commit it. List the open questions to the user at the end — do not guess answers.
- When Supabase REST returns error 57014 (statement timeout): switch to batched deletes ≤50 rows per call. Never retry the same large delete — it will time out again.
- When asked "are there other high-leverage improvements?" → give a structured tier analysis (impact × effort), do not implement unless explicitly approved.
- When user says "implement all tiers" or "proceed" → implement everything safe; explicitly name what is skipped and why (risk, complexity, missing prerequisite).
- Multiple rapid user messages during a session accumulate as a queue. Complete the current task fully before addressing the next. Do not stop mid-implementation to acknowledge queued messages. (2026-03-18)
- "analyse and improve X — nothing showing" = fix mode. Diagnose data pipeline first (is the source table populated? when does the cron run?) before redesigning UI. (2026-03-18)
- "X panel is not showing / still seeing old panel" → check page.tsx imports first. If code is correct and deployed, cause is Vercel delay or browser cache. Tell user: Ctrl+Shift+R. (2026-03-18)
- "commit and push all completions" = batch everything uncommitted into one commit, then push once. (2026-03-18)
- "commit, push" or "commit + push" = stage relevant files, commit with descriptive message, then `git push` synchronously with 90s timeout. Do not use background push — use `timeout 90 git push 2>&1` so the result is immediate. No separate "wait and read" turns needed. (2026-03-18)
- "read endsession.md" = execute all endsession steps immediately from session context, no pauses between steps, no user prompts. (2026-03-18)
- "implement all identified improvements now" or "implement all X now" = execute everything that is safe (low blast radius, no new deps, no schema changes) without requesting per-item approval. Name any skipped items + reason at the end. (2026-03-18)
- When given a multi-part prompt (e.g. layout fix + grid visibility), execute ALL parts in one pass. Do not implement part 1, report, then ask to continue. Surface is already approved — complete the full scope. (2026-03-18)

---

## 7. QUERY EXECUTION — NO SUPABASE CLI

`supabase` CLI is NOT installed. `grep` and `head` are NOT available in the shell environment.

**Git push / SSH environment note:** (2026-03-18)
SSH port 22 to github.com is unreliable in this sandbox (intermittent timeout). The permanent fix
is `~/.ssh/config` routing `github.com` through `ssh.github.com:443` with `ssh.github.com` in
`known_hosts`. This is already configured. If push hangs or times out, it is a transient network
issue — retry once before escalating. Do NOT report this as a permanent blocker.
```
# ~/.ssh/config (already set)
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/id_ed25519
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

All database queries run via the **Supabase REST API** using credentials from `.env.local`.

**Credentials (read from `.env.local` at session start if not already known):**
```
NEXT_PUBLIC_SUPABASE_URL  →  SB_URL
SUPABASE_SERVICE_ROLE_KEY →  SB_KEY
```

**Count query (use `Prefer: count=exact` + `Range` header, parse `content-range` response):**
```bash
curl -s "$SB_URL/rest/v1/table_name?filter=eq.value&select=id" \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" \
  -H "Prefer: count=exact" -H "Range-Unit: items" -H "Range: 0-0" \
  -I | python3 -c "import sys; [print(l) for l in sys.stdin if 'content-range' in l.lower()]"
```
Result format: `content-range: */N` where N = total count.

**Row fetch + Python aggregation (no grep/head available):**
```python
python3 -c "
import urllib.request, json
url = 'https://<project>.supabase.co/rest/v1/table_name?select=col1,col2&filter=eq.value'
req = urllib.request.Request(url, headers={'apikey': '<key>', 'Authorization': 'Bearer <key>'})
rows = json.loads(urllib.request.urlopen(req).read())
print(json.dumps(rows, indent=2))
"
```

**REST filter syntax:**
- `column=eq.value` — equals
- `column=in.(a,b,c)` — IN list
- `column=gt.value` — greater than
- `column=is.null` — IS NULL
- `column=not.is.null` — IS NOT NULL
- `order=col.desc&limit=10` — ordering + limit

**Parallel queries:** run multiple curl/python calls in the same bash block using `;` or `&&`.

**Never use** `grep`, `head`, `tail`, `sed`, `awk` — not available. Use Python inline instead.

**Check if a column exists on a table (migration probe):** (2026-03-18)
`GET /rest/v1/{table}?select={column}&limit=0` → 200 = exists, 400/404 = missing.
`GET /rest/v1/{table}?limit=0` → 200 = table exists, 404 = missing.
`/rest/v1/information_schema/...` returns 404 — not exposed via PostgREST.

---

## 8. KNOWN SYSTEM BEHAVIOUR (do not mistake for bugs)

- `strategic_insights` is populated by `/api/strategic-analysis` cron (daily 08:00 UTC). It will be empty
  on a fresh deployment until the cron fires. The Strategy page now has a fallback layer:
  `strategic_movements` (14-day window) provides live data without GPT. Use `strategic_movements` as the
  "always-on" layer; `strategic_insights` as the "enhanced AI" layer. (2026-03-18)

- Three ambient panel systems exist in radar-ui. As of 2026-03-18:
  - `KnowledgePanel` — ACTIVE (encyclopaedia, replaces the below two)
  - `HistoricalCapsule` — DISABLED (file exists, not imported)
  - `FeatureDiscoveryPanel` — DISABLED (file exists, not imported)
  - `TutorialHint` — DISABLED (file exists, removed from page.tsx)
  Do not re-enable old panels. KnowledgePanel is the single ambient education system.

- `zoom: 0.9` on `html` in globals.css scales the entire rendered viewport uniformly. All fixed-position
  elements, Framer Motion animations, and SVG overlays scale correctly. Safe in all modern browsers.
  Does NOT break `position: fixed` layout — elements remain anchored to the (scaled) viewport. (2026-03-18)

- `extract-sections` intentionally skips `fetch_quality='shell'` and `fetch_quality='js_rendered'` snapshots.
  The health endpoint counts ALL `sections_extracted=false` as backlog — this causes a false-positive
  `snapshot_extraction_backlog` warning when non-full-quality snapshots accumulate.
  Fix applied (2026-03-17): pre-pass bulk marks them done immediately.

- `fetch_quality` is determined at fetch time by text element count:
  `< 3 elements → shell` | `< 500 visible chars → js_rendered` | otherwise → `full`

- Snapshot failures with `http_status: 404` and `failure_class: unknown_fetch_failure` are normal —
  some competitor pages return 404 on specific paths.

- `challenge_page` snapshot failures are normal — anti-bot walls on some competitor pages.

- Pool 1 `competitor_feeds` rows with `discovery_status = feed_unavailable` and `feed_url = null` are NOT a
  code bug — auto-discovery found no RSS feeds. Pool 1 is dormant until RSS URLs are manually supplied
  via `POST /api/activate-feed`.

- `pipeline_events` stage names are short codes, NOT endpoint names:
  `snapshot` | `extract` | `compare` | `diff` — use these in SQL queries, not full endpoint paths.

- The runtime pipeline processes ALL competitors unconditionally — `tracked_competitors` is a radar-ui
  overlay only. Ghost competitors with no org tracking still run through every cron stage.

- Core pipeline tables (competitors, monitored_pages, snapshots, page_sections, section_baselines,
  section_diffs, signals) were created directly in Supabase before migrations. Migration 013 ran
  `CREATE TABLE IF NOT EXISTS` and skipped them — so these original tables originally lacked ON DELETE
  CASCADE FKs. Migration 049 adds CASCADE to the 7 safe relationships. Until 049 is applied, deleting
  a competitor still requires the manual bulk-delete order in DIAGNOSTIC EFFICIENCY PROTOCOL above.
  After 049: `DELETE FROM competitors WHERE id = '...'` cascades automatically (except signals,
  interpretations, signal_feedback — those are intentionally RESTRICT).

- `pending_review` signals on fresh competitors create a bootstrap deadlock: no signals → low pressure →
  no promotion → no signals. Bootstrap fix applied (2026-03-17) in `update-pressure-index.ts`: if a
  competitor has zero signals in `pending` or `interpreted`, their highest-confidence `pending_review`
  signal (≥ 0.50) is promoted once per run regardless of pressure_index. Bootstrap now also prefers
  high_value page signals over ambient/standard when selecting the candidate.

- `onboard-competitor` URL validation is reachability-only (HTTP 200 + content-length). It does not check
  whether the URL is the right kind of page. Bad URLs that return 200 (sitemaps, legal pages, product tools,
  single posts, homepage locale variants) are silently committed. Content-pattern gate added (2026-03-17)
  in `rejectPageUrl()` — applied before commit, after HTTP validation passes.

- `fetch-snapshots` budget exhaustion: with INVOCATION_BUDGET_MS (now 25000ms on Vercel Pro), pages near
  the back of the query result were consistently skipped. Fix applied (2026-03-17): Fisher-Yates shuffle
  on urlEntries before processing. Budget-skipped pages now emit `pipeline_events` with
  `skip_reason: budget_exhausted` and trigger a Sentry `fetch_budget_exhausted` warning.

- `section_diffs` does NOT have a `page_section_id` column. It references `page_sections` via
  `previous_section_id` and `current_section_id`, and references `monitored_pages` directly via
  `monitored_page_id`. The cascade path for competitor cleanup runs through `monitored_page_id`.

- Migrations 040–043, 048, 049 applied 2026-03-18. All pool constraint gaps resolved.
  pool_events.source_type now allows all ATS + investor + product + procurement + regulatory types.
  ON DELETE CASCADE active on 7 core FK relationships. Realtime CDC active on competitors +
  strategic_movements. Single-line competitor deletion now works without manual bulk-delete order.

- Sequential migrations can leave cumulative constraint gaps: migrations 039 and 040 each extended
  `competitor_feeds.source_type` but silently omitted `pool_events.source_type`. Migration 041
  documents and fixes this. When diagnosing silent ingest failures (eventsInserted: 0 with
  feedsIngested > 0), check pool_events constraints directly — not just competitor_feeds. (2026-03-18)

- `RadarRealtimeSync` is a no-op until migration 048 is run in Supabase
  (`ALTER PUBLICATION supabase_realtime ADD TABLE competitors, strategic_movements`).
  Until then, the 60s fallback poll in Radar.tsx handles updates.

- CSS Grid `h-full` does NOT fill height automatically when rows are implicit/auto-sized. Without an
  explicit `grid-rows-[1fr]`, the implicit row tracks are content-sized — leaving dead space inside a
  full-height grid container even when `overflow-hidden` is applied at every ancestor. Fix: add
  `grid-rows-[1fr]` to the grid container. Distinct from flexbox: `flex-1` fills remaining space,
  `h-full` on a grid container does not propagate that height to its tracks. (2026-03-18)

- Flex containers between a viewport-height root and a `h-full` child must have `min-h-0` to allow
  correct shrink behaviour. `overflow-hidden` alone does not guarantee this — without `min-h-0`, a
  flex item with `min-height: auto` (default) resists shrinking and can crowd out siblings. Add
  `min-h-0` defensively to any intermediate `flex-1` flex container in the viewport height chain. (2026-03-18)

- Migrations 046 (`discovery_candidates`) and 047 (`last_fetched_at`) must be run in Supabase SQL Editor
  before their respective features activate. Both are swallowed-error non-blocking until applied.

- Sentry cron monitors must be created manually in the Sentry UI — they are NOT auto-created from
  check-in calls alone. If a handler emits `captureCheckIn` but no monitor exists, the check-in is
  silently discarded. After any new cron handler is added, create the matching monitor in
  Sentry UI → Crons → Create Monitor. Slug must match exactly. Use schedule type Crontab, UTC,
  check-in margin 5 min, max runtime 10 min, failure tolerance 1, environment = production.
  Confirmed missing on 2026-03-17: `ingest-careers` (11 * * * *) and `promote-careers-signals`
  (13 * * * *) — created manually.

- `@sentry/nextjs` in radar-ui requires `instrumentation.ts` + `sentry.server.config.ts` +
  `sentry.edge.config.ts` for automatic server/edge error capture. Without these files, only
  manually-instrumented call sites (captureException, captureCheckIn) report to Sentry — unhandled
  RSC and middleware errors are silently dropped. Files added 2026-03-17.
  `lib/sentry.ts` init guard must use `SentrySDK.getClient()` not a local `initialised` flag,
  to prevent double-init when instrumentation.ts has already run.

- Watchdog covers pipeline_events stages: snapshot, extract, diff, signal, interpret, baseline,
  movement_synthesis (90m threshold), radar_narrative (120m threshold). It does NOT cover
  generate-sector-intelligence (3×/week — too infrequent for freshness check), detect-movements,
  or any once-daily/weekly cron. For those, rely on Sentry cron monitor "missed" detection.

- AI-heavy runtime handlers (interpret-signals, synthesize-movement-narratives,
  generate-radar-narratives, generate-sector-intelligence, suggest-selector-repairs) require explicit
  `maxDuration` in vercel.json `functions` block. Without it, Vercel Pro default (15s) applies and
  AI calls time out silently. Set 2026-03-17: interpret-signals=30s, narratives=90s, sector=90s,
  repairs=60s. Frontend cron routes require `export const maxDuration = N` in the route file itself.

---

## 9. END-OF-TASK CHECK (MANDATORY)

**Fast path** — output one line when all pass:
`surface=X | mode=X | deps=no | contract=no | commit+push=done | target=X`

**Slow path** — only expand items that fail or are non-trivial:
- Dependencies added: name + package.json + surface correct?
- Contract changed: which surfaces impacted + reviewed?
- Commit/push pending: why + what action needed?

Done = committed → pushed → correct Vercel project deployed → no build errors

---

## 10. END OF SESSION — MANDATORY UPDATE

At the end of every session, run `docs/workflow/endsession.md` as a checklist.

If the session revealed new operational knowledge — failure modes, confirmed behaviours, efficiency
shortcuts, prompt execution rules, query patterns — update **this file** (startsession.md) directly
under the relevant section before the session ends.

Sections to update:
1. **DIAGNOSTIC EFFICIENCY PROTOCOL** — new ordered steps or shortcuts
2. **TOKEN EFFICIENCY RULES** — patterns that reduced unnecessary reads or calls
3. **KNOWN SYSTEM BEHAVIOUR** — behaviours confirmed as intentional (not bugs)
4. **PROMPT EXECUTION RULES** — new rules about how to interpret and execute instructions
5. **QUERY EXECUTION** — new REST patterns or shell constraints discovered
6. **OPPORTUNISTIC IMPROVEMENT** — criteria confirmed or refined this session

Commit the update with:
  docs(workflow): update startsession.md — [one-line description of what was learned]

---

## 11. DOCUMENT AUTHORITY

Source of truth:
- docs/workflow/startsession.md  ← this file

Compressed mirrors:
- CLAUDE.md (root)
- radar-ui/CLAUDE.md

Compression rule:
CLAUDE.md contains only:
- identity
- surfaces
- session gate
- mode rules
- blast radius definition
- stop conditions
- end-of-task check

All other sections live here in startsession.md.

Rule:
- startsession.md is canonical
- CLAUDE.md files must mirror it
- do NOT edit mirrors directly
- if divergence occurs → update mirrors immediately

---

## 12. REFERENCE

Surface rules:
docs/workflow/SURFACE_OWNERSHIP_RULES.md

Deployment:
docs/workflow/DEPLOYMENT_BOOTSTRAP.md

Fail-safe:
docs/architecture/VERCEL_DEPLOYMENT_FAILSAFE.md

System:
docs/METRIVANT_MASTER_REFERENCE.md

Root:
CLAUDE.md

Frontend:
radar-ui/CLAUDE.md

If missing:
→ check docs/ for relocated files
