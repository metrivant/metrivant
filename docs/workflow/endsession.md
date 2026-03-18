# END SESSION — EXECUTABLE PROCEDURE

When this file is triggered, execute every step below automatically.
Do not present a blank form. Derive all answers from session context and write the outputs directly.

---

## STEP 1 — DERIVE SESSION FACTS

From memory of this session, determine and state:

```
Task summary:        [what was built, fixed, or diagnosed — 1–2 sentences]
Surface:             frontend | runtime | both | none
Mode:                build | fix | diagnose | refactor | document
Files changed:       [list every file modified or created]
Files deleted:       [list or "none"]
```

---

## STEP 2 — DEPLOYMENT STATE

Answer each question from session context:

```
Changes committed:   yes | no | not needed
Changes pushed:      yes | no | not needed
Vercel target:       metrivant-ui | metrivant-runtime | both | none
Deployment status:   success | pending | failed | not needed
```

If committed = no or pushed = no → state explicitly:
→ "Changes are local only. Must commit + push before live."

A change is only live if: commit → push → correct Vercel project deployed → no build errors.

---

## STEP 3 — DEPENDENCY CHECK

```
New dependencies introduced:   yes | no
```

If yes, verify and state:
- package name
- declared in which package.json (root vs radar-ui)
- surface confirmed correct: yes | no

---

## STEP 4 — CONTRACT CHECK

Scan files changed. For each, answer:

```
API shape changed:          yes | no
Function signatures changed: yes | no
Shared types changed:        yes | no
DB schema changed:           yes | no  →  migration written | SQL manual | not needed
Env var requirements changed: yes | no
```

If any = yes:
- state impacted surfaces
- confirm cross-surface impact was reviewed

---

## STEP 5 — ARCHITECTURE SAFETY

```
Unintended cross-surface changes:   yes | no
High blast radius changes:          yes | no
```

If yes to either → state what it is and whether it was explicitly approved.

---

## STEP 6 — LESSONS LEARNED (AUTO-EXTRACT)

From this session, identify any of the following that were newly confirmed:

- a failure mode not previously documented
- a system behaviour that could be mistaken for a bug
- a diagnostic shortcut or efficiency pattern
- a new prompt execution rule
- a query pattern or shell constraint

For each finding, determine which section of `startsession.md` it belongs to:
1. DIAGNOSTIC EFFICIENCY PROTOCOL
2. TOKEN EFFICIENCY RULES
3. KNOWN SYSTEM BEHAVIOUR
4. MODE INFERENCE RULE
5. PROMPT EXECUTION RULES
6. QUERY EXECUTION

If any findings exist → execute STEP 7.
If none → state "No new system knowledge this session."

---

## STEP 7 — UPDATE startsession.md (AUTO-WRITE)

For each finding from STEP 6:
- append it under the correct section in `docs/workflow/startsession.md`
- write it as a concise bullet in the same style as existing entries
- include the date in parentheses: (YYYY-MM-DD)

After writing → stage and commit with:
```
docs(workflow): update startsession.md — [one-line description of what was learned]
```

Do not ask for approval. Write and commit directly.

---

## STEP 8 — MEMORY UPDATE

Check `~/.claude/projects/-home-arcmatrix93/memory/MEMORY.md`.

If this session changed:
- system architecture
- pool state
- active features
- known remaining issues

→ update the relevant memory file(s) directly.
→ update MEMORY.md index if a new file was added.

---

## STEP 9 — FINAL STATE

State:

```
System consistent with documentation:   yes | no
Known issues remaining:                 yes | no
```

If known issues remain → list each one explicitly:
- what it is
- what action is needed
- who must take the action (operator SQL | code change | commit | deploy)

---

## STEP 10 — CLOSE

Output a single closing block:

```
SESSION CLOSED
──────────────
Done:     [1-line summary]
Live:     yes | no  (committed + pushed + deployed)
Pending:  [list or "none"]
```

No trailing summaries. No re-explaining what was done. The diff and memory speak for themselves.
