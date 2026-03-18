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

If found → append to correct section of `startsession.md` (§6 Diagnostic, §6 Token, §6 Prompt, §7 Query, §8 Known Behaviour) → commit with:
`docs(workflow): update startsession.md — [one-line description]`

If none → state: "No new system knowledge."

**3. Memory** — update `~/.claude/projects/-home-arcmatrix93/memory/` only if this session changed:
- system architecture
- pool activation state
- active features
- known remaining issues

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
