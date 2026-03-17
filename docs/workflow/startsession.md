# SESSION BOOTSTRAP

> Read this at the start of every session. One read, no questions.

---

## Identity

Metrivant is a **deterministic competitive intelligence radar** — not a dashboard, not an AI toy.
Architecture is the foundation. Preserve it unless there is a clear defect.

---

## Surfaces & Vercel Bindings

| Surface | Directory | Vercel Project | package.json |
|---|---|---|---|
| Runtime | `api/`, `lib/`, `migrations/` | `metrivant-runtime` | `package.json` (root) |
| Frontend | `radar-ui/` | `metrivant-ui` | `radar-ui/package.json` |

**Critical rule:** Every import must resolve from the `package.json` of its own surface.
Vercel builds each project independently. Cross-surface `node_modules` do not exist at build time.

Verify bindings before touching deployment:
```bash
cat .vercel/project.json          # → metrivant-runtime
cat radar-ui/.vercel/project.json # → metrivant-ui
```

Scan for missing deps (warn-only):
```bash
bash scripts/check-surface-deps.sh
```

---

## Session Rules

State the surface before any work begins:
```
surface: frontend | runtime | both
```

If unclear — stop and ask. No assumptions.

---

## Core Pipeline

```
competitors → monitored_pages → snapshots → page_sections
  → section_baselines → section_diffs → signals
  → interpretations → strategic_movements → radar_feed → UI
```

Supabase = state machine. Vercel = stateless execution. Sentry = observability.

---

## Engineering Constraints

- Read before editing
- Propose before implementing
- Smallest safe change wins
- No architecture redesign, no large rewrites, no new major dependencies
- No backend contract changes unless fixing a clear defect
- No speculative abstractions
- Deletion over bloat

---

## End-of-Task Check

```
Surface:              frontend | runtime | both | none
Dependencies touched: yes / no
  If yes — declared in correct package.json: yes / no
Commit/push:          done | pending
Expected Vercel target: metrivant-ui | metrivant-runtime | both | none
```

A change is **live** only when: committed → pushed → correct Vercel project deployed → no build error.

---

## Reference Docs

| Topic | File |
|---|---|
| Surface rules | `docs/workflow/SURFACE_OWNERSHIP_RULES.md` |
| Deployment protocol | `docs/workflow/DEPLOYMENT_BOOTSTRAP.md` |
| Vercel fail-safe | `docs/architecture/VERCEL_DEPLOYMENT_FAILSAFE.md` |
| Full system reference | `docs/METRIVANT_MASTER_REFERENCE.md` |
| Root instructions | `CLAUDE.md` |
| Frontend instructions | `radar-ui/CLAUDE.md` |
