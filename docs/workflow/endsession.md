# END SESSION CHECK

Run this at the end of every session.

---

TASK SUMMARY

- What was done:
- Surface: frontend | runtime | both | none
- Mode: build | fix | diagnose | refactor | document

---

DEPLOYMENT STATE

- Changes committed: yes | no | not needed
- Changes pushed: yes | no | not needed
- Expected Vercel target:
  metrivant-ui | metrivant-runtime | both | none
- Deployment status: success | pending | failed | not needed

A change is only live if:
commit → push → correct Vercel deploy → no errors

---

DEPENDENCIES

- Any new dependencies introduced: yes | no
- If yes:
  - declared in correct package.json: yes | no
  - surface verified: yes | no

---

CONTRACT CHECK

- Any change to:
  - API shape
  - function signatures
  - shared types
  - database schema
  - env requirements

yes | no

If yes:
- impacted surface(s) stated: yes | no
- cross-surface impact reviewed: yes | no

---

ARCHITECTURE SAFETY

- Any unintended cross-surface changes: yes | no
- Any high blast radius changes: yes | no

If yes:
- explicitly approved: yes | no

---

DOCUMENTATION UPDATE

If task changed:
- architecture
- pipeline
- surfaces
- deployment
- pools
- AI layers
- workflow rules

→ Documentation updated: yes | no

If no:
→ reason:

---

LESSONS / SIGNALS

Did this session reveal:
- a new failure mode
- a missing rule
- a source of confusion
- a gap in documentation

yes | no

If yes:
- documented: yes | no

---

FINAL STATE

- System consistent with documentation: yes | no
- Any known issues remaining: yes | no

If yes:
- list:

---

RULE

If any answer above is uncertain → resolve before ending session.

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

## PROMPT EXECUTION RULES

- One step at a time means: do the step, report findings, wait. Do not auto-advance to next step.
- Report findings before proposing fixes. In diagnose mode, findings first, fix proposal second.
- When a fix is approved: state the plan (1–3 lines), list the file(s), implement, type-check, commit, push.
- Do not summarise what was done after a commit — the diff speaks for itself. Skip trailing summaries.
