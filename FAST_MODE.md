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
