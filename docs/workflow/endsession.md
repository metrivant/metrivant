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

The backend and frontend have fundamentally different definitions of "perfect." The backend is a machine — it succeeds when it runs autonomously, produces accurate intelligence, and never requires intervention. The frontend is a product — it succeeds when a human opens it, understands the truth about their competitive landscape in seconds, takes action, and comes back tomorrow.

These are different problems. Engineering perfection is invisible to users. Product perfection is felt.

---

### RUNTIME PERFECT STATE (the machine)

The runtime is perfect when it runs indefinitely without human intervention and the quality of its output improves every week.

**Input layer (zero-touch):** The system continuously discovers new competitors from media signals and auto-onboards them when confidence exceeds threshold. It monitors every relevant page across 7 pools, self-repairs broken URLs via AI suggestion, auto-discovers replacement feed URLs, and expands page coverage into new page types. Every competitor that matters is tracked. Every feed that exists is ingested. No operator configures anything.

**Detection layer (zero-noise):** Every change detected is either a genuine competitive signal or is silently suppressed. Noise patterns are learned from user feedback and auto-applied. Cross-pool deduplication ensures each real-world event produces exactly one signal. Velocity anomaly dampening prevents website redesigns from flooding the pipeline. Confidence scoring is self-calibrating. The signal-to-noise ratio improves every week.

**Intelligence layer (zero-hallucination):** AI interpretations are validated against raw evidence by a second model. Movement narratives are validated against their supporting signals. Hallucinated outputs are confidence-downgraded and prevented from polluting downstream artifacts. The user never sees intelligence the system doesn't trust. The system never shows its internal quality machinery — it simply delivers trustworthy output.

**Self-healing layer (zero-maintenance):** Failed crons retry themselves. Broken pages find new URLs. Stale competitors get diagnosed and unblocked. Noise patterns are learned and suppressed. New competitors are discovered and onboarded. The system gets better every week without being touched.

**Current status: SUBSTANTIALLY COMPLETE.** All five pillars are implemented. The remaining runtime work is operational — monitoring, tuning thresholds, expanding sector coverage. No architectural gaps remain.

---

### FRONTEND PERFECT STATE (the product)

The frontend is perfect when every interaction answers a question the user already has, every screen delivers value in under 3 seconds, and every feature earns its existence by driving retention or conversion.

**First value (zero-wait):** A user signs up, selects their sector, and within minutes understands what the product does. Not hours — minutes. An onboarding progress indicator shows pipeline status: "Monitoring 7 pages... First snapshot captured... Baseline building..." The empty radar state communicates certainty: your intelligence is coming. The first signal arrives with a notification. The first brief arrives on Monday. The user never wonders "is this thing working?"

**Core loop (zero-friction):** The user opens the radar → sees who is moving → clicks a competitor → reads the intelligence → understands the implication → acts. Every step in this loop takes under 2 seconds. No loading spinners. No dead clicks. No confusion about what to do next. The intelligence drawer answers: what changed, what it means, and what to do. The evidence chain is one click away. The user trusts the system because the system shows its work — but only when asked.

**Signal feedback (zero-waste):** The user can mark any signal as "valid" or "noise" with one click. This isn't a feature for the user — it's the input that activates the entire backend learning loop. Noise patterns, confidence calibration, and interpretation quality all depend on this data. Without it, the backend's self-learning systems are inert. The UI must make feedback effortless — a thumb up/down on each signal card, not a form. The user helps the system by using the system.

**Weekly brief (zero-effort intelligence):** The Monday email is the #1 retention mechanism. It arrives in the inbox, reads in 90 seconds, and tells the user three things: what moved, what it means for them, and what they should consider doing. If the brief is good, the user opens Metrivant. If the brief is slop, the user cancels. Brief quality is the product's heartbeat.

**Feature discovery (zero-confusion):** ORBIT mode, gravity field, telescope, strategy panel, market map — these features exist but users may never find them. Navigation must be clear. Feature hints must be contextual, not intrusive. The knowledge panel educates. The About overlay demonstrates. Every feature the user discovers is a reason to stay.

**Conversion (zero-hesitation):** The landing page demonstrates the value loop in 45 seconds. The pricing is anchored against $200-1000/mo enterprise alternatives. The free trial removes all risk. The upgrade path from Analyst to Pro is triggered by hitting the competitor limit — a natural moment of proven value. The billing flow is frictionless. Stripe handles everything.

**Mobile (zero-exclusion):** The core intelligence — signals, movements, briefs, alerts — is accessible on mobile. The radar is desktop-first (SVG precision requires screen space), but the intelligence drawer, briefs, and alerts work on any device. A user checking their phone on Monday morning sees the brief. A critical alert reaches them wherever they are.

**Emotional state (zero-anxiety):** The product feels calm, authoritative, and trustworthy. Not gamified. Not noisy. Not desperate for attention. The user opens it and feels like they're looking at the truth. The aesthetic — dark canvas, electric blue, precision typography — communicates: this is a serious instrument for serious operators. The 45-second engagement feature is the last resort for landing page visitors, not a pattern for the core product.

**Current status: SIGNIFICANT GAPS REMAIN.** The backend is a machine that works. The frontend is a product that needs to earn its users. The gaps are:
1. Signal feedback UI does not exist (backend learning loops are inert)
2. First-value onboarding has no progress indicator (user waits in the dark)
3. Brief quality is untested with real users
4. Feature discovery relies on exploration, not guidance
5. Mobile intelligence delivery is gated (desktop holding page)
6. Upgrade prompts may not be triggering at the right moments

---

### THE DISTINCTION

The backend asks: "Is the system correct?"
The frontend asks: "Does the user care?"

A technically perfect backend producing intelligence that nobody reads is a failure. A slightly imperfect backend producing intelligence that a user opens every Monday morning and acts on is a success.

**The runtime is the engine. The frontend is the reason the engine exists.**

Every remaining session should prioritize the frontend — because the backend is done and the product is not.

---

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
