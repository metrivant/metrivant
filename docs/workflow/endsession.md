# END SESSION — EXECUTE IMMEDIATELY

Do not read, pause, or request approval between steps.
Derive all answers from session context. No form-filling.

---

## FAST PATH — default

Use when ALL of the following are true:
- no new dependencies introduced
- no schema changes
- no API/contract changes
- no unresolved errors

**Execute in order:**

**1. Deployment state** — one line:
```
committed: yes/no | pushed: yes/no | target: metrivant-ui | metrivant-runtime | both | none
```
If committed=no or pushed=no → state: "Not live. Run git push."

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
  - §6 Diagnostic Efficiency — new ordered steps or shortcuts
  - §6 Token Efficiency — patterns that reduced unnecessary reads/calls
  - §6 Prompt Execution — new rules for interpreting instructions
  - §7 Query Execution — new REST patterns or shell constraints
  - §8 Known Behaviour — tag as [B] permanent | [I] incident (patched)
  → commit: `docs(workflow): update startsession.md — [one-line description]`

Cull rule: if §8 has [I] entries older than 60 days describing patched bugs with no ongoing triage value → delete them (keeps §8 scannable).

If none → state: "No new system knowledge."

**3. Memory** — update `~/.claude/projects/-home-arcmatrix93/memory/` only if this session produced a **delta** in:
- system architecture or component structure
- pool activation state
- active feature set (new feature shipped or disabled)
- known remaining issues that persist to next session

Skip memory update if: only bug fixes, only docs changes, or only changes already captured in startsession.md §8.

**4. Close block:**
```
SESSION CLOSED
──────────────
Done:     [1-line]
Live:     yes | no
Pending:  [list or "none"]
```

---

## SLOW PATH — use when fast-path conditions fail

Run only the failing checks:

**Dependencies:** name / package.json location / surface confirmed?
**Schema:** migration written | SQL manual | not needed
**Contract:** impacted surfaces stated + cross-surface impact reviewed?
**Errors:** list each + action needed + who acts

Then continue with fast-path steps 2–4.

---

## RULES

- Skip steps that trivially pass — don't output boilerplate "no" answers for every check.
- The diff and memory speak for themselves. No trailing summaries.
- "read endsession.md" = execute all steps now without waiting for user prompts between steps.

---

## STRATEGIC DIRECTION — STANDING PRIORITY

**Objective: Persistent Competitor Intelligence Contexts**

The single highest-leverage capability gap in the current system.

**The problem:**
Every AI layer in Metrivant interprets signals without memory. GPT-4o receives a diff and produces a summary with no knowledge of what this competitor did last month, what strategic hypothesis was forming, or whether previous signals were validated or noise. The system detects movement but does not accumulate strategic understanding. Six months of signals exist in the database. None of it informs the next interpretation.

**The solution:**
A per-competitor rolling context document — `intelligence/[competitor-slug].md` — maintained by Claude, updated after each signal batch, read before each interpretation run. Each document holds:

```
## [Competitor Name] — Strategic Intelligence Context

### Current Hypothesis
[What is this competitor building toward? 1–2 sentences. Confidence: high|medium|low]

### Evidence Trail
- [signal type] [date]: [what changed] → [validates|contradicts|neutral] hypothesis
- ...

### Noise Log
- [date]: [signal type] — flagged noise, reason: [A/B test | seasonal | cosmetic]

### Open Questions
- [Unanswered pattern or anomaly — updated as signals arrive]

### Strategic Arc
[Month-by-month summary of confirmed movements, 3-sentence max per period]
```

**Why this maximises model capability:**
Context is the primary lever for LLM quality. Pattern recognition across time is the strongest thing the model can do — but only when historical intelligence is structured, persistent, and retrievable at inference time. This converts every interpretation from a stateless diff-to-summary call into a grounded, hypothesis-aware analysis. Every downstream layer (narratives, briefs, movements) improves immediately and compounds. The intelligence already exists in `signals`, `interpretations`, `strategic_movements`, and `radar_narratives` — the gap is synthesis and persistence, which is precisely what Claude is built for.

**Implementation path (when ready):**
1. Schema: `intelligence/` directory in repo, one `.md` per tracked competitor, seeded from existing `strategic_movements` + `radar_narratives` history
2. Update flow: after each `interpret-signals` cron batch, Claude reads the context, appends new evidence, revises hypothesis if warranted — called from `api/update-competitor-contexts.ts`
3. Interpretation upgrade: pass `intelligence/[slug].md` as system context when calling GPT-4o in `interpret-signals.ts`
4. Brief upgrade: pass all relevant context docs when assembling `generate-brief`
5. No new external deps, no schema changes to pipeline tables, no API contract changes

**Signal that this is ready to build:**
When there are ≥ 3 competitors with ≥ 5 signals each and ≥ 2 confirmed movements — the intelligence base is rich enough for accumulated context to be meaningfully better than stateless interpretation.
