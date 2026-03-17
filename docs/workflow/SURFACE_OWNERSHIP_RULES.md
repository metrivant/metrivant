# SURFACE OWNERSHIP RULES

> Enforcement: `/scripts/check-surface-deps.sh`
> Bootstrap: `/docs/workflow/DEPLOYMENT_BOOTSTRAP.md`

---

## Surface Map

```
metrivant/                        ← repo root
├── api/          ┐
├── lib/          │  RUNTIME surface
├── migrations/   │  Vercel project: metrivant-runtime
├── vercel.json   │  .vercel/project.json → projectName: metrivant-runtime
└── .vercel/      ┘

└── radar-ui/     ┐
    └── **        │  FRONTEND surface
                  │  Vercel project: metrivant-ui
                  └  radar-ui/.vercel/project.json → projectName: metrivant-ui
```

---

## Dependency Ownership Rule

**Every import must be satisfiable from the `package.json` of its own deployment surface.**

No cross-surface assumptions. Vercel builds each surface independently. It installs only from that surface's `package.json` and lockfile. The other surface's `node_modules` does not exist during the build.

**Correct:**

```
radar-ui/app/api/generate-brief/route.ts
  imports openai
  → openai must be in radar-ui/package.json ✓
```

**Wrong:**

```
radar-ui/app/api/some-route.ts
  imports openai
  → openai only in root package.json ✗
  → build fails on Vercel with: Cannot find module 'openai'
```

**Rule applies to ALL packages** — OpenAI, Stripe, Resend, Supabase, or any other dependency used inside `radar-ui/` must be declared in `radar-ui/package.json`.

---

## Build Truth

Vercel builds each project independently from its root directory:

| Project | Root dir | package.json used |
|---|---|---|
| `metrivant-runtime` | `/` | `package.json` |
| `metrivant-ui` | `radar-ui/` | `radar-ui/package.json` |

When `metrivant-ui` builds, it runs `npm install` in `radar-ui/`. It has no access to the root `node_modules`. A package present at the root but absent from `radar-ui/package.json` will cause the build to fail immediately.

---

## Architectural Note

Several API routes in `radar-ui/app/api/` call OpenAI directly. This increases frontend fragility: any change to the AI dependency must be reflected in both `package.json` files.

Preferred long-term location for LLM routes: `metrivant-runtime`.

This is a future concern. Do not act on it as part of any session unless explicitly scoped.
