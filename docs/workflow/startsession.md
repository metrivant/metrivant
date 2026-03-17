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
→ analyze impact across:
  - surfaces
  - deployment
  - pipeline
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
```bash
cat .vercel/project.json
cat radar-ui/.vercel/project.json
```

Dependency check:
```bash
scripts/check-surface-deps.sh
```
If missing → manually verify imports vs package.json

---

## SESSION START GATE (MANDATORY)

Before any work:

```
surface: frontend | runtime | both
```

If unclear:
STOP — ask

---

## PRE-CHANGE CHECK

If surface changes mid-session:
→ re-confirm surface

Before adding dependencies:
1. confirm correct surface
2. confirm correct package.json

---

## CORE PIPELINE (DO NOT BREAK)

```
competitors → monitored_pages → snapshots → page_sections
→ section_baselines → section_diffs → signals
→ interpretations → strategic_movements → radar_feed → UI
```

Constraints:
- Supabase = state machine
- Vercel = stateless execution
- pipeline = deterministic

---

## ENGINEERING RULES

- read before editing
- propose before implementing
- smallest viable change
- no large rewrites
- no new major dependencies
- no schema changes without necessity
- delete > add
- no speculative abstractions

---

## STOP CONDITIONS (CRITICAL)

STOP if:
- surface unclear
- dependency ownership unclear
- deployment target unclear
- change crosses surfaces unintentionally
- change alters pipeline behavior without justification
- new external dependency introduced without verification

Never guess.

---

## END-OF-TASK CHECK (MANDATORY)

```
Surface: frontend | runtime | both | none
Dependencies added: yes / no
→ declared correctly: yes / no
Commit/push: done | pending | not needed
Expected Vercel target: metrivant-ui | metrivant-runtime | both | none
```

If task changed:
- architecture
- surfaces
- deployment
- pipeline
- workflow rules
- constraints
- dependency model

→ verify this file is still accurate
→ update if needed

Additionally:
If new lessons, failure patterns, or implicit rules emerge:
→ update this file or relevant documentation immediately

Done = committed → pushed → correct project deployed → no errors

---

## REFERENCE (MAY MOVE)

Surface rules:
`docs/workflow/SURFACE_OWNERSHIP_RULES.md`

Deployment:
`docs/workflow/DEPLOYMENT_BOOTSTRAP.md`

Fail-safe:
`docs/architecture/VERCEL_DEPLOYMENT_FAILSAFE.md`

System:
`docs/METRIVANT_MASTER_REFERENCE.md`

Root:
`CLAUDE.md`

Frontend:
`radar-ui/CLAUDE.md`

If missing:
→ check docs/ for relocated files
