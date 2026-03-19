# END SESSION — EXECUTE IMMEDIATELY

Do not read, pause, or request approval between steps.
Derive all answers from session context. No form-filling.
Maximise parallelism: evaluate steps 1–3 from session context in parallel before writing anything.
Total endsession overhead target: ≤4 tool calls for fast path.

---

## FAST PATH — default

Use when ALL of the following are true:
- no new dependencies introduced
- no schema changes
- no API/contract changes
- no unresolved errors

**Execute in order:**

**1. Deployment state** — verify with `git status` + `git log --oneline -1`, then one line:
```
committed: yes/no | pushed: yes/no | target: metrivant-ui | metrivant-runtime | both | none
```
If committed=no → commit all session changes (single commit, descriptive message).
If pushed=no → `git push` (async hook, completes <5s).
If already done → state the deployed commit hash. No action needed.

**2. New knowledge** — scan this session for any of:
- failure mode not previously documented
- system behaviour that could be mistaken for a bug
- triage shortcut or efficiency pattern
- new prompt execution rule
- environment / tooling constraint

Do NOT capture:
- resolved bugs already reflected in the committed code
- implementation details already in CLAUDE.md or MASTER_REFERENCE.md
- one-time task state or session-specific decisions
- anything explained by `git log` alone

If found → append under the correct section of `startsession.md`:
  - §3 Session Gate — new mode inference patterns or compound mode rules
  - §5 Parallel Execution — new parallelism patterns or agent delegation rules
  - §5 Context Window — new context management patterns
  - §5 Decision Speed — refined risk classification for decision categories
  - §6 Diagnostic Efficiency — new ordered steps, shortcuts, or triage patterns
  - §6 Token Efficiency / Tool Use — patterns that reduced unnecessary reads/calls
  - §6 Token Efficiency / Response Format — output compression patterns
  - §6 Prompt Execution — new rules for interpreting instructions
  - §7 Query Execution — new REST patterns or shell constraints
  - §8 Known Behaviour — tag as [B] permanent | [I] incident (patched)
  → commit: `docs(workflow): update startsession.md — [one-line description]`

Cull rule: if §8 has [I] entries older than 60 days describing patched bugs with no ongoing triage value → delete them (keeps §8 scannable).

If none → state: "No new system knowledge."

**3. Memory** — update `~/.claude/projects/-home-arcmatrix93-metrivant/memory/` only if this session produced a **delta** in:
- system architecture or component structure
- pool activation state or feed configuration
- active feature set (new feature shipped or disabled)
- user preferences, workflow rules, or feedback that applies to future sessions
- known remaining issues that persist to next session
- project context (deadlines, blockers, decisions with ongoing impact)

Memory type selection:
- Architecture/feature/pool delta → `project` type memory
- User correction or confirmed approach → `feedback` type memory
- External system reference discovered → `reference` type memory
- User role/preference learned → `user` type memory

Check existing memories before writing — update stale entries rather than creating duplicates.
Skip memory update if: only bug fixes, only docs changes, or only changes already captured in startsession.md §8.

**4. Session continuity snapshot** — if this session touched multiple subsystems or left pending work:
```
STATE SNAPSHOT (for next session):
  surface: [what was worked on]
  deployed: [commit hash or "not pushed"]
  pending: [list of incomplete items, if any]
  blockers: [external blockers, if any]
  key decisions: [non-obvious decisions that inform future work]
```
Save as a `project` type memory if any pending/blockers exist. Skip entirely if session was self-contained with no loose ends.

**5. Close block:**
```
SESSION CLOSED
──────────────
Done:     [1-line]
Live:     yes | no
Pending:  [list or "none"]
```

---

## SLOW PATH — use when fast-path conditions fail

Run only the failing checks — skip those that trivially pass:

**Dependencies:** name / package.json location / surface confirmed? If cross-surface → flag explicitly.
**Schema:** migration written | SQL block for manual apply | not needed. If SQL needed → include full SQL block in close output.
**Contract:** impacted surfaces stated + cross-surface impact reviewed? List each changed contract: function signature, API shape, type, env var.
**Errors:** list each + root cause + action needed + who acts (Claude Code next session | operator | external).

Then continue with fast-path steps 2–5.

---

## RULES

- Skip steps that trivially pass — don't output boilerplate "no" answers for every check.
- The diff and memory speak for themselves. No trailing summaries.
- "read endsession.md" = execute all steps now without waiting for user prompts between steps.
- Maximise parallelism: evaluate steps 1–3 from session context in parallel before writing. Batch all file writes (startsession.md + memory files) into minimal tool calls.
- Self-recovery: if a commit or push fails, diagnose and fix autonomously. Do not report failure and stop.
- Alignment rule: every operational pattern captured in step 2 must be findable by a fresh session reading startsession.md. Knowledge captured only in memory is invisible to sessions that don't load that specific memory file — prefer startsession.md for universal rules.
- Crash resilience: the startsession.md crash-resilience rule means critical knowledge should already be captured incrementally during the session. Endsession is the final sweep, not the only capture point.

---

## STANDING QUESTION — ASK AT EVERY SESSION END

> "From a birds-eye view of the current system state: what is the single highest-leverage objective that Claude Code is capable of achieving at maximum capacity — the task that would take a human engineer the most calendar time, has a clear implementation path, and compounds the most value over time?"

Answer in one paragraph. Do not implement unless explicitly approved.

Evaluation criteria (rank by):
1. **Calendar-time multiplier** — how many human-days does this save?
2. **Compound value** — does this produce more signal density / coverage / accuracy over time?
3. **Implementation clarity** — is the path unambiguous with existing patterns?
4. **Risk** — low blast radius strongly preferred; schema changes or new deps reduce ranking

Then immediately output the following block, filled in with the answer above as a ready-to-paste Claude Code session-start prompt:

```
NEXT SESSION PROMPT:
──────────────────────────────────────────────────────────────
[Paste-ready Claude Code prompt targeting the identified objective.
Format: specific task description → exact files to touch → acceptance criteria → constraints.
Must be self-contained: no references to "previous session" or "what we discussed".
Must follow CLAUDE.md workflow (understand → plan → implement → verify → report).
Must specify: surface (runtime|frontend|both), mode (build|fix|refactor), blast radius estimate.]
──────────────────────────────────────────────────────────────
```

---

## CURRENT ANSWER (2026-03-19)

The highest-leverage objective is **end-to-end automated page discovery + intelligent selector seeding for existing competitors**. The system currently monitors a fixed 7-page-type catalog per competitor (seeded at onboarding). After onboarding, no new pages are discovered even when competitors launch new products, open investor sections, add regulatory disclosure pages, or restructure their sites — so the pipeline progressively misses more and more surface area as competitors evolve. A page-discovery scan that: (1) crawls each competitor's sitemap + top-level link graph weekly, (2) classifies candidate pages with GPT-4o-mini against the existing page-type taxonomy, (3) upserts newly found high-value pages into `monitored_pages`, and (4) seeds extraction rules via the existing `lib/onboarding-selectors.ts` pattern — would compound indefinitely: every discovered page generates incremental signal density for every future pipeline cycle. A human engineer would need 1–2 weeks to design the link-graph crawler, classifier, dedup logic, and integration with the existing health/repair pipeline. Claude Code can implement it end-to-end in one focused session. This directly extends `api/expand-coverage.ts` (which already runs weekly but only for competitors with zero coverage on a given page type) into a full dynamic discovery layer.

```
NEXT SESSION PROMPT:
──────────────────────────────────────────────────────────────
Build a dynamic page discovery layer for existing competitors in Metrivant.

Context: `api/expand-coverage.ts` (cron: Sundays 06:00 UTC) currently only adds pages
for page types where a competitor has zero coverage. It does not discover NEW page types
or novel URLs that fall outside the fixed 7-type catalog.

Objective: extend the system to continuously expand coverage as competitors evolve.

Task:
1. Read `api/expand-coverage.ts`, `lib/onboarding-selectors.ts`, `api/onboard-competitor.ts`
   fully before planning.
2. Add a `discoverNewPages(competitorId, websiteUrl, sector)` function in a new file
   `lib/page-discovery.ts` that:
   - Fetches the competitor sitemap (xml) + scrapes top-level nav links from homepage
   - Deduplicates against existing monitored_pages for this competitor
   - Calls GPT-4o-mini to classify each candidate URL as one of the existing page_type values
     (or "irrelevant") with confidence score
   - Returns candidates with confidence >= 0.65 and page_type not already monitored
3. Wire this into `api/expand-coverage.ts` as a second pass (after the existing gap-fill pass):
   - Run `discoverNewPages` per competitor
   - Upsert new monitored_pages rows (page_class from page_type taxonomy)
   - Seed extraction rules via `lib/onboarding-selectors.ts` seedSmartRules
   - Emit pipeline_events for each new page added
4. Surface ownership: runtime surface only (api/, lib/). No radar-ui changes.
5. No new dependencies — use existing fetch + OpenAI SDK pattern.
6. Acceptance: `npx tsc --noEmit` passes, vercel.json maxDuration for expand-coverage
   remains 90s (add chunking if needed to stay within budget).
7. Report: new pages added per run estimate, LLM call count, failure modes guarded.

Constraints: no schema changes beyond what already exists. All new pages must pass
`rejectPageUrl()` validation before upsert. Do not touch the existing gap-fill logic.
──────────────────────────────────────────────────────────────
```
