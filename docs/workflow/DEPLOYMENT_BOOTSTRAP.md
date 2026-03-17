# DEPLOYMENT BOOTSTRAP

> Surface rules: `/docs/workflow/SURFACE_OWNERSHIP_RULES.md`

---

## Session Start

State the surface before any work begins:

```
surface: frontend | runtime | both
```

If unclear — stop and ask. No assumptions.

Verify Vercel project binding:

```bash
cat .vercel/project.json           # → metrivant-runtime
cat radar-ui/.vercel/project.json  # → metrivant-ui
```

Optionally scan for missing dependencies:

```bash
bash scripts/check-surface-deps.sh
```

---

## Three Truths

**Repo truth** — what the code says right now (`git status`, `git log`)

**Deployment truth** — what Vercel has built and served (commit hash in Vercel dashboard)

**Session truth** — what changed in this session (files modified, deps added, commits made)

These can diverge. A feature is only live when all three align:
code committed + pushed + deployed in the correct Vercel project.

---

## End-of-Task Check

Output this block at the end of every session that touches code:

```
Surface:
frontend | runtime | both | none

Dependencies touched:
yes / no

If yes — declared in correct package.json:
yes / no

Commit/push:
done | pending

Expected Vercel target:
metrivant-ui | metrivant-runtime | both | none
```

---

## Live Rule

A change is live only when:

1. Code committed to `main`
2. Pushed to `origin/main`
3. Correct Vercel project deployed successfully
4. No build error

If any step is missing — the change is not live.
