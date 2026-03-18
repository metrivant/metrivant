#!/usr/bin/env node
// Installs a pre-push git hook that runs TypeScript checks before every push.
// Guards: skips silently when run in CI (GitHub Actions), Vercel, or outside a git repo.
// Runs automatically via the `prepare` npm lifecycle script after `npm install`.

const fs   = require("fs");
const path = require("path");

// Never run in automated environments
if (process.env.CI || process.env.VERCEL || process.env.GITHUB_ACTIONS) {
  process.exit(0);
}

// Only run inside the repo root (where .git exists)
const gitDir = path.join(__dirname, "..", ".git");
if (!fs.existsSync(gitDir)) {
  process.exit(0);
}

const hooksDir = path.join(gitDir, "hooks");
if (!fs.existsSync(hooksDir)) {
  fs.mkdirSync(hooksDir, { recursive: true });
}

const hookPath = path.join(hooksDir, "pre-push");

const hookContent = `#!/bin/sh
# Installed by scripts/setup-git-hooks.js — do not edit manually.
# Runs TypeScript checks for both the backend and the UI before every push.
# Both checks run in parallel — total wall time ~60s instead of ~120s.
# Blocks the push if either check fails, preventing broken builds on Vercel.

REPO_ROOT="$(git rev-parse --show-toplevel)"
BACKEND_OUT="$(mktemp)"
UI_OUT="$(mktemp)"

echo "[pre-push] Running TypeScript checks (backend + UI in parallel)..."

(cd "$REPO_ROOT"         && npm run typecheck) > "$BACKEND_OUT" 2>&1 &
BACKEND_PID=$!
(cd "$REPO_ROOT/radar-ui" && npm run typecheck) > "$UI_OUT" 2>&1 &
UI_PID=$!

wait $BACKEND_PID; BACKEND_EXIT=$?
wait $UI_PID;      UI_EXIT=$?

cat "$BACKEND_OUT"
cat "$UI_OUT"
rm -f "$BACKEND_OUT" "$UI_OUT"

if [ $BACKEND_EXIT -ne 0 ]; then
  echo "[pre-push] BLOCKED: backend TypeScript errors found. Fix before pushing."
  exit 1
fi

if [ $UI_EXIT -ne 0 ]; then
  echo "[pre-push] BLOCKED: radar-ui TypeScript errors found. Fix before pushing."
  exit 1
fi

echo "[pre-push] TypeScript checks passed."
`;

fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
console.log("✓ pre-push hook installed (.git/hooks/pre-push)");
