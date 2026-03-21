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

## METRIVANT PERFECT STATE — THE DESTINATION

Metrivant in its perfect state is a **fully autonomous competitive intelligence system** — a closed-loop machine where the runtime pipeline generates intelligence, the frontend renders it as a precision instrument, and every layer self-improves without human intervention.

### RUNTIME (the engine)

**Input layer (zero-touch):** The system continuously discovers new competitors from media signals and auto-onboards them when confidence exceeds threshold. It monitors every relevant page across 7 pools (page-diff, newsroom, careers, investor, product, procurement, regulatory, media), self-repairs broken URLs via AI suggestion, auto-discovers replacement feed URLs, and expands page coverage into new page types without operator input. Every competitor that matters is tracked. Every feed that exists is ingested.

**Detection layer (zero-noise):** Every change detected is either a genuine competitive signal or is silently suppressed. Noise patterns are learned from operator feedback and auto-applied. Cross-pool deduplication ensures each real-world event produces exactly one signal. Velocity anomaly dampening prevents website redesigns from flooding the pipeline. Confidence scoring is self-calibrating — section weights adjust automatically based on historical accuracy rates. The signal-to-noise ratio improves every week without being touched.

**Intelligence layer (zero-hallucination):** AI interpretations are validated against raw evidence by a second model before reaching the user. Movement narratives are validated against their supporting signals. Hallucinated outputs are flagged, confidence-downgraded, and prevented from polluting downstream artifacts. Sector narratives are grounded in multi-source media clusters. Weekly briefs are assembled from pre-validated artifacts — not raw data. The intelligence is trustworthy by construction.

**Self-healing layer (zero-maintenance):** A daily/weekly chain of handlers runs autonomously:
- Coverage: heal-coverage (heuristic) → resolve-coverage (AI) → deactivate
- Feeds: check-feed-health → repair-feeds → deactivate after 3 weeks
- Competitors: detect-stale-competitors → auto-diagnose pipeline stage → auto-repair
- Selectors: suggest-selector-repairs → auto-accept high-confidence
- Quality: learn-noise-patterns + calibrate-confidence (weekly)
- Reliability: retry-failed-stages (hourly, auto-recovers transient failures)
- Growth: suggest-competitors → auto-score → auto-onboard from media

Failed crons retry themselves. Broken pages find new URLs. Stale competitors get unblocked. The system gets better every week without being touched.

### FRONTEND (the instrument)

**Radar (the primary surface):** The radar is not a dashboard — it is a precision instrument. Competitors are positioned by momentum on a live SVG field. Node size, pulse frequency, and echo rings encode real data. One glance shows who is accelerating. The selected state reveals the full intelligence chain: signals → interpretations → movements → evidence. ORBIT mode renders the same data as a physics simulation — momentum warps spacetime. The gravity field surface shows competitive density as topological deformation.

**Intelligence delivery (zero-latency):** Critical movements trigger real-time alerts with movement type and confidence. The intelligence drawer shows detected changes, AI assessments, and strategic advisories. The signal ticker streams live activity. Weekly briefs arrive pre-assembled. The strategy page surfaces cross-competitor patterns the moment they emerge. The operator opens the product, sees the truth, and acts.

**Ambient awareness (zero-effort):** The telescope panel reflects live radar statistics. The knowledge panel cycles educational content. The daily brief overlay surfaces headlines on login. HUD panels render tactical data inside the radar SVG. Every ambient element is data-driven — nothing is decorative.

**Operator visibility (zero-guessing):** The ops dashboard shows 12 real-time sections: signal backlog, cron health, pipeline stages, signal quality, pool activity, errors, coverage health, selector repairs, feed health, stale competitors, cross-pool dedup stats, and competitor suggestions. Auto-refreshes every 30 seconds. The pipeline page shows the public engineering schematic. Every layer of the system is observable.

**Brand (zero-compromise):** Orbitron headings, Share Tech Mono body, Inter for long-form. Electric blue (#00B4FF) accent on near-black (#000002) canvas. Lightning background, neon glow escalation, tagline sheen. The product feels like a classified intelligence terminal, not a SaaS dashboard. The 45-second engagement feature demonstrates the full value loop in 8 seconds.

### THE GAP

The gap between current state and perfect state is the standing question below. Each session closes one gap. There is a finite number of gaps. We are heading toward the end.

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

**COMPLETED** — `api/backfill-feeds.ts` built and deployed with weekly cron. All 6 pools (newsroom, careers, investor, product, procurement, regulatory), chunked concurrency=5, sequential EDGAR for SEC rate limits, wall-clock guard, Sentry monitoring, per-pool stats response.
