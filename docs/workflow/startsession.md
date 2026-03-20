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

**COMPOUND MODES:**

When a task spans multiple modes (e.g., "diagnose why X is broken and fix it"):
→ execute phases sequentially: diagnose → report findings → fix
→ do NOT pause between phases unless high-risk mismatch detected
→ state mode transitions inline: "diagnose complete — switching to fix mode"
→ if first phase reveals scope larger than expected: STOP and re-confirm

**MODE ESCALATION:**

| From → To       | Rule |
|------------------|------|
| diagnose → fix   | if root cause is obvious AND fix is ≤5 lines + low blast radius → propose fix inline with findings, no round-trip |
| diagnose → build | STOP — requires explicit approval |
| refactor → fix   | if refactoring reveals a bug, fix it immediately; note the discovery |
| fix → refactor   | do NOT expand; fix the bug, report adjacent debt separately |

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

### Execution Mode: Sequential (stability rule — 2026-03-20)

Default posture: ONE task at a time. Sequential execution. No parallel agents.

**Rationale:** Parallel agents + heavy builds (next build, tsc) exhaust CPU/RAM and crash the session.

| Operation type | Parallel? |
|---|---|
| Independent file reads (2-3 small files) | YES — lightweight, OK |
| Independent edits to different files | YES — lightweight, OK |
| Agent spawns | NO — one agent at a time, foreground only |
| Heavy commands (build, tsc, npm install) | NO — one at a time, never background |
| REST/SQL queries | YES — lightweight, OK |

**Crash prevention guardrails:**
- Never run `next build` and `tsc --noEmit` simultaneously
- Never spawn more than 1 agent at a time
- Never run background builds — always foreground with timeout
- If a task is large, break it into commits: implement → commit → push → next piece
- Prefer `tsc --noEmit` over `next build` for verification (lighter)
- After each objective: commit and push immediately before starting next

**Agent delegation decision:**
- Task requires >3 independent searches → spawn ONE Explore agent (foreground)
- Task requires edits to 2+ subsystems → do them sequentially, not parallel agents
- Research question → spawn ONE agent, wait for result, then proceed

**One objective at a time:**
- Complete current objective fully (implement → verify → commit → push)
- Only then start next objective
- Never interleave objectives

### Context Window Discipline (capacity rule)

- Do not re-read files already in the current context window. Reference from memory.
- Prefer offset+limit reads for files >200 lines — read only the relevant section.
- When spawning agents, include ALL necessary context in the prompt. Agents have zero conversation history.
- For long sessions: key decisions and state survive compression automatically — do not re-derive what was already established.
- When multiple files are likely needed (handler + shared lib + types), read all speculatively in one message rather than discovering dependencies sequentially.

### Decision Speed (capability rule)

Low blast radius decisions do not require deliberation:
- File formatting, variable naming within a function, comment wording → just do it
- Which of two equivalent approaches for a ≤5-line change → pick one, move on
- Whether to read an adjacent file that might be relevant → read it speculatively

High blast radius decisions require explicit evaluation:
- Anything in the contract-change gate list
- Anything crossing surface boundaries
- Anything affecting pipeline determinism

Default: act fast on safe choices, slow down on risky ones. Do not treat every decision as risky.

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

**Parallel diagnostic queries:** run steps 1 + 2 + 3 in one message when all are likely needed. Do not serialise — they answer different questions and are independent.

**Fast exit:** stop the moment root cause is confirmed. Do not continue reading for completeness. If health reveals the answer, skip steps 2–5 entirely.

**Inline fix proposal:** if root cause is identified and fix is ≤5 lines + low blast radius, propose fix inline with diagnostic findings. Eliminates a full round-trip for trivial fixes.

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
- Use plain `git push` — pre-push hook is async (exits 0 immediately, tsc runs in background). Results in `.typecheck-log` at repo root. No timeout needed; push completes in <5s. (2026-03-18)
- Scan discipline: extract only function signatures, key conditions, queries, critical logic paths. Multiple matches → return top 2–3 only. Large files → scan, do not dump.
- New tables not yet in generated Supabase types (`lib/database.types.ts`) require `(supabase as any)` casts. tsc will emit TS2769 "No overload matches" on `.from("new_table")`. Fix: cast supabase, cast result arrays to `unknown` first if needed. Pattern consistent with existing handlers (interpret-signals.ts). (2026-03-19)
- Prop threading: when a server component needs to pass live data to a stateless child, compute a typed stats struct in the page and thread it down. Avoids a new API route. Pattern: `page.tsx → Parent({stats}) → Child({stats})`. (2026-03-18)
- When a large component (~4000 lines) has a visual element that "doesn't appear": check `radarClip` / `clipPath` containment before reading the full render tree. One grep for the element key + one Read offset+limit to confirm its parent group resolves the issue in 2 tool calls. (2026-03-18)
- Agent tool for Radar.tsx edits: prefer a single agent with full instructions over sequential back-and-forth. Agent reads the full file once, makes all edits, runs tsc, commits. Saves 4–6 turns per multi-edit session. (2026-03-18)
- Supabase Security Advisor warnings (RLS Disabled, Security Definer Views): before hardening, grep for `.from('table_name')` and `.from('view_name')` across api/ + lib/ + radar-ui/ to confirm actual access pattern. In this codebase all flagged views are service-role-only — REVOKE from anon/authenticated resolves warnings with zero code changes. (2026-03-18)
- Multiple simultaneous background push failures (exit 124) are always transient SSH timeouts. Verify `git status` vs `origin/main` — if "up to date", all failures are stale noise. Do not retry individually. (2026-03-18)
- `vercel.json` crons use single-line compact JSON formatting — Edit tool string matching fails on multiline patterns. Use Python `json.load` + `json.dump` to modify vercel.json programmatically. (2026-03-18)
- tsc incremental cache (`--incremental + tsBuildInfoFile`) does NOT meaningfully reduce check time on this CPU-constrained sandbox (still ~60s warm vs ~85s cold). Bottleneck is CPU not I/O. Async hook is the correct fix; incremental helps only on more capable machines. (2026-03-18)
- After any Edit to `vercel.json`, immediately validate with `python3 -c "import json; json.load(open('vercel.json')); print('valid')"`. The file is compact single-line JSON — Edit tool brace-counting errors silently produce invalid JSON. Validation takes <1s and catches the class of bug before commit. (2026-03-18)
- Maximise parallel tool calls: if reading 3 files, issue 3 Read calls in one message. If running 2 independent queries, issue 2 Bash calls. Never serialise independent operations — every sequential round-trip wastes a full response cycle. (2026-03-19)
- Speculative parallel reads: when a task likely requires 2–3 related files (handler + lib + types), read all in one message rather than reading one, discovering the dependency, then reading the next. (2026-03-19)
- Read-once discipline: never re-read a file already in the current context window. If you need a specific section, reference it from what was already read. Exception: file was edited since last read. (2026-03-19)
- Batch edits: when making multiple independent edits to different files, issue all Edit calls in one message. Same-file edits must be sequential (each changes file state). (2026-03-19)
- Pre-flight verification: before editing, confirm the target file exists and the target code region matches expectations with a quick Read. One speculative read prevents a failed edit + recovery cycle. (2026-03-19)
- Failure self-recovery: if an Edit fails (string not found), immediately re-read the target region and retry with corrected context. Do not ask the user — diagnose and fix the tool failure autonomously. (2026-03-19)
- Agent-based large edits: for multi-edit tasks on files >1000 lines (e.g., Radar.tsx), spawn a single agent with complete instructions. Agent reads once, makes all edits, runs tsc, reports. Saves 4–6 sequential turns. (2026-03-19)

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
| Multi-part task | progress marker per part: `✓ part1 · ✓ part2 · → part3` |
| Error/failure | cause → fix → result (3 lines max) |

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
4. Am I re-stating something already in context? → delete it
5. Am I explaining a decision obvious from the code? → delete it

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
- "commit, push" or "commit + push" = stage relevant files, commit with descriptive message, then `git push`. Hook is async — push completes in <5s. No timeout needed. (2026-03-18)
- "read endsession.md" = execute all endsession steps immediately from session context, no pauses between steps, no user prompts. (2026-03-18)
- When any answer involves SQL that must be manually applied in Supabase SQL Editor, include the full SQL block at the end of that answer — even if the SQL was already shown earlier in the session. (2026-03-19)
- "implement all identified improvements now" or "implement all X now" = execute everything that is safe (low blast radius, no new deps, no schema changes) without requesting per-item approval. Name any skipped items + reason at the end. (2026-03-18)
- Alert dedup pattern without a signal_id: when a row needs state-tracked one-time alerting but has no natural unique key to use in the `alerts` table, use a sentinel column on the source row itself (`_alerted_at TIMESTAMPTZ NULL`). `check-signals` queries `WHERE _alerted_at IS NULL`, sends email, then `UPDATE SET _alerted_at = now()`. No separate join table needed. Pattern used in `competitor_contexts.hypothesis_shift_alerted_at`. (2026-03-18)
- When given a multi-part prompt (e.g. layout fix + grid visibility), execute ALL parts in one pass. Do not implement part 1, report, then ask to continue. Surface is already approved — complete the full scope. (2026-03-18)
- Crash resilience: after completing each discrete task in a session, update MEMORY.md and relevant memory files with any new operational knowledge (design decisions, confirmed behaviours, new patterns). Do not wait until endsession.md — a crash before that point loses the session's learnings. (2026-03-19)
- Compound task execution: when given a multi-part instruction, execute ALL parts in one pass without pausing between them. Do not ask "shall I continue?" after each part. Only pause if a part fails or reveals a high-risk mismatch. (2026-03-19)
- Decision caching: once a decision is made in a session (e.g., "this is a frontend fix", "the bug is in X"), do not re-derive it. Reference the prior decision and proceed. Avoids circular re-analysis. (2026-03-19)
- Failure recovery: if an edit fails, a query errors, or a build breaks — diagnose and fix autonomously before reporting to user. Only escalate if self-recovery fails after one attempt. (2026-03-19)
- Pre-commit verification: after all edits in a task, run `tsc --noEmit` (runtime) or `cd radar-ui && npx tsc --noEmit` (frontend) before committing. Fix type errors in the same pass — do not commit known-broken code. (2026-03-19)
- Scope discipline: when implementing, resist the urge to improve adjacent code. Fix what was asked. Report adjacent issues separately. Scope creep is the #1 capacity drain. (2026-03-19)
- Git operation batching: when multiple files are changed, stage all relevant files and commit once. One commit per logical change, not one commit per file. (2026-03-19)
- "checkpoint" = mid-session save point. Execute ALL of these without pausing: (1) commit all session changes (single commit, descriptive message), (2) `git push`, (3) update memory files with any new knowledge/state delta, (4) evaluate the next highest-leverage task from the current session and propose it as a ready-to-paste prompt. Use the endsession.md §next-step evaluation criteria (calendar-time multiplier, compound value, implementation clarity, risk). (2026-03-19)

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

**Quick triage index:** `radarClip` | `zoom-transform` | `background-tsc` | `cascade/FK` | `pipeline-tables` | `feeds-dormant` | `bootstrap-deadlock` | `onboard-url` | `CSS-grid/flex` | `sentry-monitors` | `maxDuration` | `pool-events-types` | `realtime-cdc` | `AI-handlers-timeout` | `competitor-sector` | `scrapingbee-fallback` | `sentry-alerting` | `pool-zero-result`
Tag key: [B] = permanent ongoing behaviour · [I] = incident, already patched

- [B] `competitors` table has NO `sector` column. Sector is stored on `organizations` and reached via
  `tracked_competitors.org_id`. Any cron or handler needing per-competitor sector must do:
  (1) query `tracked_competitors` for org_id, (2) query `organizations` for sector, (3) default to "saas"
  for competitors not in tracked_competitors (ghost competitors the pipeline still processes).
  Pattern in `api/expand-coverage.ts` → `buildSectorMap()`. (2026-03-18)

- [B] `strategic_insights` is populated by `/api/strategic-analysis` cron (daily 08:00 UTC). It will be empty
  on a fresh deployment until the cron fires. The Strategy page now has a fallback layer:
  `strategic_movements` (14-day window) provides live data without GPT. Use `strategic_movements` as the
  "always-on" layer; `strategic_insights` as the "enhanced AI" layer. (2026-03-18)

- Three ambient panel systems exist in radar-ui. As of 2026-03-18:
  - `KnowledgePanel` — ACTIVE (encyclopaedia, replaces the below two)
  - `HistoricalCapsule` — DISABLED (file exists, not imported)
  - `FeatureDiscoveryPanel` — DISABLED (file exists, not imported)
  - `TutorialHint` — DISABLED (file exists, removed from page.tsx)
  Do not re-enable old panels. KnowledgePanel is the single ambient education system.

- `zoom: 0.9` was removed from globals.css (2026-03-18, reversed later). Do not re-add it — it caused
  all text to render at 90% of declared size and caused subpixel blur on CSS-animated elements. (2026-03-18)

- [I] `extract-sections` intentionally skips `fetch_quality='shell'` and `fetch_quality='js_rendered'` snapshots.
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
  Cycle stages: `snapshot` | `extract` | `compare` | `diff` — run every crawl cycle, must have recent success.
  Event-driven stages: `signal` | `interpret` | `movement_synthesis` — only write events when there is pending work.
  Absence of recent events on signal/interpret/movement_synthesis = healthy quiet pipeline, NOT stale. Only flag
  warn if active failures exist with no recent recovery in the past 2h. Treat `unknown` (no 48h history) as
  the only unambiguous "not yet seen" state for event-driven stages.

- The runtime pipeline processes ALL competitors unconditionally — `tracked_competitors` is a radar-ui
  overlay only. Ghost competitors with no org tracking still run through every cron stage.

- Core pipeline tables (competitors, monitored_pages, snapshots, page_sections, section_baselines,
  section_diffs, signals) were created directly in Supabase before migrations. Migration 013 ran
  `CREATE TABLE IF NOT EXISTS` and skipped them — so these original tables originally lacked ON DELETE
  CASCADE FKs. Migration 049 adds CASCADE to the 7 safe relationships. Until 049 is applied, deleting
  a competitor still requires the manual bulk-delete order in DIAGNOSTIC EFFICIENCY PROTOCOL above.
  After 049: `DELETE FROM competitors WHERE id = '...'` cascades automatically (except signals,
  interpretations, signal_feedback — those are intentionally RESTRICT).

- [I] `pending_review` signals on fresh competitors create a bootstrap deadlock: no signals → low pressure →
  no promotion → no signals. Bootstrap fix applied (2026-03-17) in `update-pressure-index.ts`: if a
  competitor has zero signals in `pending` or `interpreted`, their highest-confidence `pending_review`
  signal (≥ 0.50) is promoted once per run regardless of pressure_index. Bootstrap now also prefers
  high_value page signals over ambient/standard when selecting the candidate.

- [I] `onboard-competitor` URL validation is reachability-only (HTTP 200 + content-length). It does not check
  whether the URL is the right kind of page. Bad URLs that return 200 (sitemaps, legal pages, product tools,
  single posts, homepage locale variants) are silently committed. Content-pattern gate added (2026-03-17)
  in `rejectPageUrl()` — applied before commit, after HTTP validation passes.

- [I] `fetch-snapshots` budget exhaustion: with INVOCATION_BUDGET_MS (now 25000ms on Vercel Pro), pages near
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

- SVG `radarClip` visibility trap: any element inside `<g clipPath="url(#radarClip)">` is clipped to OUTER_RADIUS=420. Elements intended to render in the black space outside the radar circle (orbit rings, HUD corner panels) must be placed OUTSIDE this group. Symptom: element exists in code, is invisible at runtime. Triage: grep for the element key/id, confirm it is not a descendant of the radarClip `<g>`. (2026-03-18)

- HUD zoom-independence pattern: SVG panels that must NOT scale with radar zoom must live in a separate overlay `<svg>` (`position:absolute; inset:0; pointerEvents:none`) sibling to the zoom canvas div — not inside it. The zoom canvas div carries `transform: scale(zoom)` which scales all children uniformly. Node-position connector lines in the overlay require: `overlayX = CENTER + (nodeX - CENTER + pan.x) * zoom`. (2026-03-18)

- SVG font size calibration in 1000×1000 viewBox: CSS pixel size = fontSize_SVG × (container_px / 1000). At a 700px display, fontSize=6 → 4.2px (invisible). Minimum readable: fontSize=10 (body labels), fontSize=12 (values), fontSize=16 (large display). Panel stroke widths: minimum 0.9 for visible borders, 2.0 for accent brackets. Apply this when diagnosing "invisible" SVG HUD panels or text elements. (2026-03-19)

- SVG corner panel overlap pattern: when a panel can appear at two positions (left/right or top/left+below), always verify that the fallback position does not share the same (x, y) as a statically-positioned sibling panel. Fix: when fallback position conflicts, stack vertically (py = sibling_y + sibling_h + gap). (2026-03-19)

- CSS `rotate` shorthand (`rotate: "45deg"`) in React inline styles is unreliable cross-browser (CSS Transforms
  Level 2, not universally supported in React's style object). Always use `transform: "rotate(45deg)"` instead.
  Applies to SVG arrowheads, rotated elements in inline style props. (2026-03-18)

- Background tsc via `| head -N` reports exit code from `head`, not `tsc`. Exit code 0 does NOT confirm a clean typecheck — always read the output file content. Use `npx tsc --noEmit 2>&1` without piping to get a reliable exit code. (2026-03-18)

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

- [B] ScrapingBee fallback in `fetch-snapshots`: when `outcome.failureClass === "challenge_page"`,
  the handler retries via ScrapingBee premium proxy (`render_js=false`, 15s timeout). Gated on
  `SCRAPINGBEE_API_KEY` env var — if absent, fallback is silently skipped. Fallback does NOT increase
  `last_fetched_at` on failure; it may still return `challenge_page` if ScrapingBee is also blocked.
  URL still marked failed — health_state will remain `challenge` or `unresolved`. (2026-03-18)

- [B] Sentry alerting is entirely Sentry UI-configured — no code path controls notification routing.
  All `captureCheckIn`, `captureException`, and `captureMessage` calls emit correctly in code, but
  whether the operator receives an email/Slack notification depends on alert rules in Sentry UI.
  If a cron monitor fails at 2am and no alert rule exists, it is silently observable-only.
  Action required at session end: verify Sentry UI → Alerts has rules for cron monitor missed/error
  and for warning-level messages. (2026-03-18)

- [B] `heal-coverage` (daily 05:00 UTC, maxDuration 90s) — automated URL repair for monitored_pages
  with health_state IN ('unresolved', 'blocked'). Flow: self-heal check (re-validate current URL) →
  discoverCandidates() once per competitor → scored candidates + template fallbacks → validateUrl +
  rejectPageUrl → UPDATE url + health_state='healthy'. If replacement URL already exists in
  monitored_pages, deactivates the broken duplicate instead. No LLM. 'challenge' and 'degraded'
  excluded (ScrapingBee handles challenge at fetch time). Sentry monitor slug: heal-coverage. (2026-03-19)

- [B] Pool ingest zero-result warning pattern: all 6 active pool ingest handlers now emit
  `captureMessage("ingest_X_empty_entries", "warning")` when feeds succeed but produce 0 new events
  and 0 duplicates. Condition: `feedsTotal > 0 && feedsIngested > 0 && eventsInserted === 0 && eventsDuplicate === 0`.
  Procurement/regulatory use `totalSources`/`sourcesIngested` instead of `feedsTotal`/`feedsIngested`.
  ingest-media-feeds does NOT follow this pattern (writes to sector_narratives directly, not pool_events). (2026-03-18)

- [B] All pool ingest + promote crons (Pools 1–6) are ALREADY SCHEDULED in vercel.json as of
  2026-03-19. CLAUDE.md reference to pools 2–6 as "dormant, activation-ready" is outdated.
  Active cron slots: ingest-careers (:11), promote-careers-signals (:13), ingest-investor-feeds (:14),
  promote-investor-signals (:16), ingest-product-feeds (:29), promote-product-signals (:31),
  ingest-procurement-feeds (:32), promote-procurement-signals (:34), ingest-regulatory-feeds (:43),
  promote-regulatory-signals (:46). Pool signal production depends on competitor_feeds configuration,
  not on scheduling. (2026-03-19)

- [B] competitor_feeds seeded state as of 2026-03-19 (fintech sector, 15 competitors):
  careers: 11/15 active (Adyen, Affirm, Brex, Checkout.com, Chime, Marqeta, Mercury, Plaid, Ramp, Robinhood, Stripe)
    source_types: greenhouse (most), lever (Plaid), ashby (Checkout.com, Ramp)
    missing: Klarna (no public ATS API), Nuvei, Rippling, Wise (use proprietary/Workday)
  investor: 3/15 active (Affirm CIK=1820953, Marqeta CIK=1522540, Robinhood CIK=1783879)
    source_type: sec_feed — EDGAR 8-K Atom feeds for US public companies
  product: 4/15 active (Stripe blog, Plaid blog, Robinhood engineering Medium, Mercury Medium)
  regulatory: 3/15 active (Affirm, Marqeta, Robinhood) — EDGAR 10-K Atom feeds
  newsroom: 4/15 active (Affirm, Marqeta, Robinhood IR RSS, Stripe blog RSS)
  procurement: 0/15 — skipped (fintech B2B, no procurement announcement feeds)
  ATS URL patterns: greenhouse=boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
    lever=api.lever.co/v0/postings/{slug}?mode=json  ashby=api.ashbyhq.com/posting-api/job-board/{slug}
  EDGAR URL pattern: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type={form}&dateb=&owner=include&count=40&search_text=&output=atom
  User-Agent for EDGAR requests (already set in ingest-regulatory-feeds.ts): "Metrivant Regulatory Monitor (research@metrivant.com)"

- [I] `promote-careers-signals` was failing with error code 23502 (NOT NULL violation) on
  `signals.section_diff_id`. Root cause: signals table was created manually pre-migration with
  section_diff_id NOT NULL. Migration 013 defined it nullable but was skipped (CREATE TABLE IF
  NOT EXISTS). Pool event signals have no section_diff_id (they come from feeds, not page diffs) —
  promote handlers set it to null, hitting the constraint. Fixed 2026-03-19: migration 056 applied
  in Supabase SQL Editor (`ALTER TABLE signals ALTER COLUMN section_diff_id DROP NOT NULL`).
  Migration 056 also idempotently applied cumulative signal_type + source_type CHECK constraints.
  Pools 2–6 promote handlers are now unblocked. (2026-03-19)

- [I] `chk_signal_type` stale CHECK constraint blocked ALL pool promote handlers (careers, investor,
  product, procurement, regulatory). Error code 23514. Root cause: original constraint created manually
  pre-migration, never dropped by migrations 038–056 which manage `signals_signal_type_check` by name.
  PostgreSQL enforces ALL CHECK constraints. Fixed 2026-03-20: migration 060 drops `chk_signal_type`,
  re-adds `signals_signal_type_check` with full cumulative type set. Also drops stale `chk_source_type`.
  Pattern: when diagnosing constraint violations, check for MULTIPLE constraints with `pg_constraint`
  or test-insert — migration-managed name may not be the only one active.

- [I] `next/dynamic` with `ssr: false` in Server Components causes Turbopack build failure at deploy time
  (error: "Ecmascript file had an error" at the dynamic() call line). tsc passes locally — this is a
  Turbopack-only restriction in Next.js 16 App Router. Fix: wrap in a thin `"use client"` component
  that re-exports the dynamic import. Pattern: PipelineSection.tsx wraps PipelineExperience.tsx. (2026-03-20)

- [B] `pool_events` table does NOT have a `pool_type` column. Pool type is inferred from `event_type` +
  `source_type` columns. Querying `pool_events` by pool requires filtering on these columns, not a
  `pool_type` field. Use `select=*&limit=1` to discover schema before writing queries. (2026-03-20)

- [B] `heal-coverage` does NOT emit pipeline_events. It uses Sentry check-ins + captureMessage
  only. After adding recordEvent (2026-03-19), stage name is "heal" — visible in pipeline_events
  from next daily run (05:00 UTC). No pipeline_events for "heal" stage = expected until then.

- Sentry cron monitors must be created manually in the Sentry UI — they are NOT auto-created from
  check-in calls alone. If a handler emits `captureCheckIn` but no monitor exists, the check-in is
  silently discarded. After any new cron handler is added, create the matching monitor in
  Sentry UI → Crons → Create Monitor. Slug must match exactly. Use schedule type Crontab, UTC,
  check-in margin 5 min, failure tolerance 1, environment = production.
  Max runtime by handler type:
    - maxDuration 30–90s (hourly pool/pipeline handlers): max runtime = 3 min
    - maxDuration 90s + heavy work (expand-coverage, reconcile-pool-events, detect-pool-sequences,
      generate-brief, strategic-analysis, generate-actions): max runtime = 10 min
  All 37 runtime + frontend cron monitors confirmed created in Sentry UI 2026-03-19.

- `@sentry/nextjs` in radar-ui requires `instrumentation.ts` + `sentry.server.config.ts` +
  `sentry.edge.config.ts` for automatic server/edge error capture. Without these files, only
  manually-instrumented call sites (captureException, captureCheckIn) report to Sentry — unhandled
  RSC and middleware errors are silently dropped. Files added 2026-03-17.
  `lib/sentry.ts` init guard must use `SentrySDK.getClient()` not a local `initialised` flag,
  to prevent double-init when instrumentation.ts has already run.

- Watchdog covers pipeline_events stages: snapshot, extract, diff, signal, interpret, baseline,
  movement_synthesis (90m), radar_narrative (120m), and all 6 pool ingest stages:
  feed_ingest, careers_ingest, investor_ingest, product_ingest, procurement_ingest, regulatory_ingest
  (each 90m threshold — 1.5× hourly cadence). Updated 2026-03-18.
  NOT covered: generate-sector-intelligence (3×/week — too infrequent), detect-movements,
  once-daily/weekly crons. For those, rely on Sentry cron monitor "missed" detection.

- All 36 runtime cron handlers now have explicit `maxDuration` in vercel.json `functions` block
  (DB-only handlers: 30s; network/AI handlers: 60s; heavy AI handlers: 90s). Updated 2026-03-18.
  Without explicit maxDuration, Vercel Pro default (15s) applies and any handler making external
  network or OpenAI calls times out silently. Frontend cron routes require `export const maxDuration = N`
  in the route file itself — vercel.json `functions` block only applies to runtime routes.

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
