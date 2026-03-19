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

**COMPLETED** — page discovery layer built (`lib/page-discovery.ts` + second pass in `api/expand-coverage.ts`). 4 beyond-catalog types (solutions, integrations, developer, about), GPT-4o-mini classification, confidence >= 0.65 gate, seedSmartRules integration, pipeline_events recording. Batch size 15, weekly cadence.

## CURRENT ANSWER (2026-03-19, updated)

The highest-leverage objective is **retroactive feed discovery for all existing competitors**. Competitors onboarded before the pool system was built (pools 1–6) have zero `competitor_feeds` rows — meaning the entire pool pipeline produces nothing for them. The feed discovery libraries already exist and are proven in `api/onboard-competitor.ts`: `lib/feed-discovery.ts` (newsroom RSS), `lib/ats-discovery.ts` (careers ATS), `lib/investor-feed-discovery.ts` (EDGAR), `lib/product-feed-discovery.ts` (changelog/blog RSS), `lib/edgar-discovery.ts` (regulatory SEC). A one-time backfill endpoint that loops over all active competitors with missing feeds and runs these discovery functions would immediately multiply signal density across all 6 active pools — every discovered feed generates ongoing pool events on every hourly cron cycle, compounding indefinitely. A human engineer needs 3–5 days to safely extract, test, and deploy. Claude Code can do it in one session. Zero schema changes, zero new deps, runtime surface only.

```
NEXT SESSION PROMPT:
──────────────────────────────────────────────────────────────
Build a retroactive feed discovery endpoint for all existing competitors.

Context: `api/onboard-competitor.ts` runs feed discovery (newsroom, careers/ATS,
investor/EDGAR, product, procurement, regulatory) for newly onboarded competitors.
Competitors onboarded before pools were built have zero competitor_feeds rows —
the pool pipeline produces nothing for them.

Feed discovery libs already exist:
- lib/feed-discovery.ts (discoverFeed — newsroom RSS)
- lib/ats-discovery.ts (discoverAts — careers ATS endpoints)
- lib/investor-feed-discovery.ts (discoverInvestorFeed — EDGAR investor)
- lib/product-feed-discovery.ts (discoverProductFeed — changelog/blog RSS)
- lib/edgar-discovery.ts (discoverEdgarFeed — regulatory SEC filings)

Task:
1. Read all 5 feed discovery libs + api/onboard-competitor.ts (steps 4–9) to understand
   the upsert patterns and error handling.
2. Create `api/backfill-feeds.ts` — cron-authenticated endpoint that:
   - Fetches all active competitors
   - For each: queries competitor_feeds to find which pool_types are missing
   - Runs the matching discovery function for each missing pool_type
   - Upserts results into competitor_feeds (same pattern as onboard-competitor)
   - Emits pipeline_events per discovery attempt (stage: "feed_backfill")
   - Processes in chunks (CONCURRENCY=5) to respect budget
3. Add cron entry in vercel.json: weekly (same day as expand-coverage), after expand-coverage.
   maxDuration: 90s.
4. Surface ownership: runtime surface only (api/, lib/). No radar-ui changes.
5. No new dependencies. No schema changes.
6. Acceptance: `npx tsc --noEmit` passes. Response includes per-pool discovery stats.
7. Report: estimated feeds discoverable, LLM call count (only ATS/product use heuristics,
   no GPT), failure modes guarded.

Constraints: never overwrite existing active feeds. Skip competitors already fully covered.
Procurement path-probing is lightweight (no LLM). EDGAR requires company name + domain.
──────────────────────────────────────────────────────────────
```
