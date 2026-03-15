# Claude Code Fast Execution Mode

When this file is present, Claude Code should prioritize speed and direct implementation over analysis and explanation.

This mode improves execution speed and prevents unnecessary reasoning cycles.

---

## Rules

1. Do not analyze the entire repository unless explicitly required.
2. Modify only the files specified in the prompt.
3. Prefer implementation over explanation.
4. Avoid long reports unless explicitly requested.
5. Run `npm run typecheck` instead of `npm run build` during development.
6. Only run `npm run build` when explicitly requested.
7. Do not perform architecture redesign unless asked.
8. Keep responses concise.
9. Avoid unnecessary repo scans.
10. When a task is clear, implement immediately.
11. On completion of every prompt: manually git commit, push, and deploy to Vercel production.

---

## Deployment Reference

### GitHub
- Repository: `github.com/metrivant/metrivant`
- Branch: `main` (production)
- Auto-deploy: Vercel triggers on every push to `main`

### Vercel Projects

| Project | Production URL | Deploy Command |
|---|---|---|
| `metrivant-ui` | `https://metrivant.com` | `vercel deploy --prod --cwd radar-ui` |
| `metrivant-runtime` | `https://metrivant-runtime.vercel.app` | `vercel redeploy <latest-deployment-url> --target production` |
| `metrivant-site` | `https://www.metrivant.com` | No local checkout — deploy via Vercel dashboard |

### Deploy Steps (end of every prompt)
```bash
# 1. Review what changed
git status && git diff --stat

# 2. Commit
git add <files>
git commit -m "..."

# 3. Push
git push origin main

# 4. Force deploy runtime (from /home/arcmatrix93/metrivant)
vercel --prod --force

# 5. Force deploy UI (from /home/arcmatrix93/metrivant/radar-ui)
vercel --prod --force
```

### Supabase
- Migrations: `/home/arcmatrix93/metrivant/radar-ui/migrations/`
- Apply via: Supabase dashboard → SQL Editor → paste migration file
- Migrations are numbered sequentially: `001_` through latest
