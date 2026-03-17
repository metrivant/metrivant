# SESSION BOOTSTRAP

Read at start of every session.

---

## SYSTEM IDENTITY (ENFORCED)

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

## SURFACES & DEPLOYMENT (HARD BOUNDARY)

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

## SESSION GATE (MANDATORY)

Before any work:

surface: frontend | runtime | both
mode: build | fix | diagnose | refactor | document

If unclear:
STOP — ask

If mode changes mid-session:
→ restate mode
→ re-confirm surface

---

## MODE INFERENCE RULE

When the user does not state a mode explicitly:

| Task description                          | Infer mode  |
|-------------------------------------------|-------------|
| "check", "verify", "look at", "is X ok"  | diagnose    |
| "fix", "it's broken", "not working"       | fix         |
| "add", "build", "implement"               | build       |
| "clean up", "simplify", "improve"         | refactor    |

State the inferred mode at the start of the session. Stop and ask only if genuinely ambiguous.

---

## MODE RULES

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

## HIGH BLAST RADIUS (SHARED DEFINITION)

High blast radius =
- affects pipeline behavior
- crosses surfaces
- changes deployment behavior
- alters shared contracts
- adds external dependencies
- changes build assumptions

Everything else = low blast radius

---

## CONTRACT-CHANGE GATE (CRITICAL)

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

---

## ADAPTIVE REFINEMENT (CONTROLLED)

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

---

## STOP CONDITIONS (CRITICAL)

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

## QUERY EXECUTION — NO SUPABASE CLI

`supabase` CLI is NOT installed. `grep` and `head` are NOT available in the shell environment.

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

---

## DIAGNOSTIC EFFICIENCY PROTOCOL

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

---

## TOKEN EFFICIENCY RULES

- Parallel tool calls for independent queries — SQL + code read in the same message when not dependent.
- Use `limit=1&select=*` to discover schema before using specific column filters.
- Use `offset+limit` when reading large files — read only the relevant section.
- Read git log before reading code — commit messages often explain "why" and prevent unnecessary file reads.
- Count/distribution queries before full row fetches: confirm scale before fetching all data.
- Stop reading when root cause is confirmed — do not continue for completeness.

---

## KNOWN SYSTEM BEHAVIOUR (do not mistake for bugs)

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

- `RadarRealtimeSync` is a no-op until migration 048 is run in Supabase
  (`ALTER PUBLICATION supabase_realtime ADD TABLE competitors, strategic_movements`).
  Until then, the 60s fallback poll in Radar.tsx handles updates.

- Migrations 046 (`discovery_candidates`) and 047 (`last_fetched_at`) must be run in Supabase SQL Editor
  before their respective features activate. Both are swallowed-error non-blocking until applied.

---

## PROMPT EXECUTION RULES

- One step at a time means: do the step, report findings, wait. Do not auto-advance to next step.
- Report findings before proposing fixes. In diagnose mode, findings first, fix proposal second.
- When a fix is approved: state the plan (1–3 lines), list the file(s), implement, type-check, commit, push.
- Do not summarise what was done after a commit — the diff speaks for itself. Skip trailing summaries.
- "pipeline audit" = diagnose mode, both surfaces. Proceed stage-by-stage, one stage per turn.
- "comprehensive report" with open questions = document mode. Generate the report to a file in docs/, commit it. List the open questions to the user at the end — do not guess answers.
- When Supabase REST returns error 57014 (statement timeout): switch to batched deletes ≤50 rows per call.
  Never retry the same large delete — it will time out again.
- When asked "are there other high-leverage improvements?" → give a structured tier analysis (impact × effort),
  do not implement unless explicitly approved.
- When user says "implement all tiers" or "proceed" → implement everything safe; explicitly name what is
  skipped and why (risk, complexity, missing prerequisite).

---

## END-OF-TASK CHECK (MANDATORY)

Surface: frontend | runtime | both | none
Mode: build | fix | diagnose | refactor | document
Dependencies added: yes / no
→ declared correctly: yes / no
Contract changed: yes / no
→ if yes: impacted surfaces stated: yes / no
Commit/push: done | pending | not needed
Expected Vercel target: metrivant-ui | metrivant-runtime | both | none

If task changed:
- architecture
- surfaces
- pipeline
- shared contracts

→ verify this file is still accurate
→ update if needed

Done = committed → pushed → correct project deployed → no errors

---

## END OF SESSION — MANDATORY UPDATE

At the end of every session, run `docs/workflow/endsession.md` as a checklist.

If the session revealed new operational knowledge — failure modes, confirmed behaviours, efficiency
shortcuts, prompt execution rules, query patterns — update **this file** (startsession.md) directly
under the relevant section before the session ends.

Sections to update:
1. **DIAGNOSTIC EFFICIENCY PROTOCOL** — new ordered steps or shortcuts
2. **TOKEN EFFICIENCY RULES** — patterns that reduced unnecessary reads or calls
3. **KNOWN SYSTEM BEHAVIOUR** — behaviours confirmed as intentional (not bugs)
4. **MODE INFERENCE RULE** — new task phrasings mapped to correct session mode
5. **PROMPT EXECUTION RULES** — new rules about how to interpret and execute instructions
6. **QUERY EXECUTION** — new REST patterns or shell constraints discovered

Commit the update with:
  docs(workflow): update startsession.md — [one-line description of what was learned]

---

## DOCUMENT AUTHORITY

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

## REFERENCE

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
