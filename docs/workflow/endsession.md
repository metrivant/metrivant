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
