# VERCEL DEPLOYMENT FAIL-SAFE SYSTEM

> Workflow enforcement only. Does not modify application logic.
> Purpose: guarantee no work is lost, misattributed, or silently abandoned.

---

## 1. REPO ARCHITECTURE (NON-NEGOTIABLE TRUTH)

```
~/metrivant
├── api/          → runtime surface (backend / cron / pipeline)
├── lib/          → runtime surface (backend logic)
├── migrations/   → runtime surface (database)
├── vercel.json   → runtime surface (runtime config)
└── radar-ui/     → frontend surface (Next.js UI)
```

**Surface classification rules:**

| Files touched | Surface |
|---|---|
| `api/*`, `lib/*`, `migrations/*`, `vercel.json` | **runtime** |
| `radar-ui/*` | **frontend** |
| Both of the above | **both** |

No exceptions. No guessing.

---

## 2. VERCEL PROJECT MAPPING

Verify project binding before every deployment:

```bash
cat .vercel/project.json
cat radar-ui/.vercel/project.json
```

**Expected output:**

| File | projectName | Deploys to |
|---|---|---|
| `.vercel/project.json` | `metrivant-runtime` | `metrivant-runtime.vercel.app` |
| `radar-ui/.vercel/project.json` | `metrivant-ui` | `metrivant.com` |

If either file is missing: **STOP and notify the user before continuing.**

---

## 3. MANDATORY TASK CLASSIFICATION

Every task MUST begin with this block:

```
TASK CLASSIFICATION:

Surface:       frontend | runtime | both
Reason:        (explain which files are involved and why)
```

If the surface is unclear: **STOP and ask the user to clarify. No guessing allowed.**

---

## 4. HARD SCOPE ENFORCEMENT

Claude must refuse to modify files outside the declared surface.

- A **frontend** task cannot modify `api/*`, `lib/*`, or `migrations/*`.
- A **runtime** task cannot modify `radar-ui/*`.

If a violation is required to complete the task: **STOP and request explicit override from the user.**

---

## 5. MIXED-SURFACE DETECTION

If `git diff` shows changes in both `radar-ui/*` and `api/*` (or `lib/*`):

1. Flag it as a **mixed-surface change**.
2. Explain both deployment paths (runtime + frontend).
3. Require explicit user confirmation before committing.

---

## 6. END-OF-TASK DEPLOYMENT CHECK (MANDATORY)

Every response that makes code changes MUST end with this block:

```
--- DEPLOYMENT CHECK ---

Surface:                (frontend | runtime | both)
Files changed:          (from git diff --name-only)
Expected Vercel project:(metrivant-runtime | metrivant-ui | both)
Commit required:        yes / no
Push required:          yes / no
Deployment path:        (URL where change will appear)

Verification steps:
  git status
  git diff --name-only
  git diff --name-only --cached
  git log --oneline -3
```

Omitting this block invalidates the task.

---

## 7. LIVE-STATE RULE

A feature is **ONLY live** when ALL five conditions are true:

1. Code exists in the repository
2. Code is committed (`git log` confirms)
3. Code is pushed (`git status` shows no ahead commits)
4. Correct Vercel project received the deployment
5. Vercel deployment succeeded (no build error)

If any step is missing: the feature is **NOT live**. Claude must state this explicitly.

---

## 8. SESSION END GATE

Claude must NOT declare a task complete unless:

- Commit state is known
- Push state is known
- Deployment target is confirmed

If any are unknown: **STOP and request confirmation from the user.**

---

## 9. LOST WORK DETECTION

If at end-of-task:

- No files changed
- No commit exists
- `git diff` is empty

Claude must output:

```
WARNING: No code changes detected.
This session may have produced prompts only.
No deployment will occur.
```

---

## 10. AMBIGUITY RULE (HARD STOP)

If task intent is unclear — frontend, runtime, or both — Claude must:

1. Stop immediately.
2. Ask: "Is this a frontend change, a runtime change, or both?"

No assumptions. No proceeding under ambiguity.

---

## 11. DEPLOYMENT PATHS REFERENCE

### Runtime deployment

```bash
# From repo root (metrivant/)
vercel --prod
```

Deploys: `api/*`, `lib/*`, `migrations/*`, `vercel.json`
Live at: `https://metrivant-runtime.vercel.app`

### Frontend deployment

```bash
# From radar-ui/
cd radar-ui && vercel --prod
```

Deploys: `radar-ui/*`
Live at: `https://metrivant.com`

### Auto-deploy (recommended)

Push to `main` → both Vercel projects auto-deploy via git integration.

---

## 12. FAILURE MODE AWARENESS

Claude must explicitly guard against these failure patterns:

| Failure mode | Guard |
|---|---|
| Editing wrong surface | Task classification check at start |
| No commit made | Session end gate |
| No push made | Session end gate |
| Frontend edit deployed to runtime | Vercel project.json verification |
| Runtime edit deployed to frontend | Vercel project.json verification |
| Silent session (prompts only, no code) | Lost work detection |

---

## 13. OVERRIDE PROTOCOL

If the user wants to bypass these rules, Claude must require explicit confirmation:

> "I confirm override of deployment safety rules."

Without this exact confirmation, do not bypass any rule above.

---

## 14. CORE PRINCIPLE

> If it is not committed, pushed, and deployed to the correct Vercel project — **it does not exist.**
