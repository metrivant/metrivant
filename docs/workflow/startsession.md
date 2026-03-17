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
→ mandatory impact analysis across:
  - surfaces
  - deployment
  - pipeline
  - shared contracts
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
cat .vercel/project.json
cat radar-ui/.vercel/project.json

Dependency check:
scripts/check-surface-deps.sh (if present)
If missing → manually verify imports vs package.json

---

## SESSION GATE (MANDATORY)

Before any work:

surface: frontend | runtime | both
mode: build | fix | diagnose | refactor | document

If unclear:
STOP — ask

If mode changes mid-session:
→ restate mode
→ re-confirm surface

---

## MODE RULES

diagnose:
- read-only
- no code changes unless explicitly approved

document:
- no code changes

refactor:
- contract-change gate must be evaluated on every edit

build / fix:
- normal rules apply

---

## HIGH BLAST RADIUS (SHARED DEFINITION)

High blast radius =
- affects pipeline behavior
- crosses surfaces
- changes deployment behavior
- alters shared contracts
- adds external dependencies
- changes build assumptions

Everything else = low blast radius

---

## CONTRACT-CHANGE GATE (CRITICAL)

If a change affects:
- function signatures used elsewhere
- API request/response shapes
- shared types
- database schema
- env var requirements
- component props used across modules
- deployment/build assumptions

→ state the contract change explicitly
→ state impacted surface(s)
→ if cross-boundary or high blast radius: STOP and request approval

---

## ADAPTIVE REFINEMENT (CONTROLLED)

If code reality differs from prompt/spec:

1. detect mismatch
2. state:
   - expected behavior
   - current code behavior
3. classify severity

Low-risk mismatch:
- contained within one file
- no change to exports, props, API shapes, database queries, or cross-surface behavior

→ note adjustment briefly, then proceed

High-risk mismatch:
- affects architecture, surfaces, deployment, pipeline, shared contracts, external behavior, or introduces a new pattern

→ STOP
→ propose minimal refinement + impact
→ wait for approval before proceeding

Default rule:
detect → classify → propose if needed → approve if high-risk → execute

Never silently refine architecture or system behavior.

---

## STOP CONDITIONS (CRITICAL)

STOP if:
- surface unclear
- mode unclear
- dependency ownership unclear
- deployment target unclear
- high-risk mismatch detected
- change crosses surfaces unintentionally
- new external dependency introduced without verification

Never guess.

---

## END-OF-TASK CHECK (MANDATORY)

Surface: frontend | runtime | both | none
Mode: build | fix | diagnose | refactor | document
Dependencies added: yes / no
→ declared correctly: yes / no
Contract changed: yes / no
→ if yes: impacted surfaces stated: yes / no
Commit/push: done | pending | not needed
Expected Vercel target: metrivant-ui | metrivant-runtime | both | none

If task changed:
- architecture
- surfaces
- pipeline
- shared contracts

→ verify this file is still accurate
→ update if needed

If task produced:
- new lessons
- new failure patterns
- clarified workflow rules
- clarified deployment rules
- clarified dependency ownership rules

→ update documentation if it reveals a failure mode, constraint, or rule not already captured
→ update startsession.md if operational truth changed
→ keep CLAUDE.md and radar-ui/CLAUDE.md aligned

Done = committed → pushed → correct project deployed → no errors

---

## DOCUMENT AUTHORITY

Source of truth:
- docs/workflow/startsession.md

Compressed mirrors:
- CLAUDE.md (root)
- radar-ui/CLAUDE.md

Compression rule:
CLAUDE.md contains only:
- identity
- surfaces
- session gate
- mode rules
- blast radius definition
- stop conditions
- end-of-task check

All other sections remain in startsession.md.

Rule:
- startsession.md is canonical
- CLAUDE.md files must mirror it
- do NOT edit mirrors directly
- if divergence occurs → update mirrors immediately

---

## REFERENCE (MAY MOVE)

Surface rules:
docs/workflow/SURFACE_OWNERSHIP_RULES.md

Deployment:
docs/workflow/DEPLOYMENT_BOOTSTRAP.md

Fail-safe:
docs/architecture/VERCEL_DEPLOYMENT_FAILSAFE.md

System:
docs/METRIVANT_MASTER_REFERENCE.md

Root:
CLAUDE.md

Frontend:
radar-ui/CLAUDE.md

If missing:
→ check docs/ for relocated files
