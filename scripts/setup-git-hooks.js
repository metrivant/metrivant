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
#
# Asynchronous type checking — push is NEVER blocked by slow tsc runs.
# Checks run in background; results land in .typecheck-log in the repo root.
# Vercel build remains the hard gate for type errors on shared branches.
#
# To run a blocking check manually: npm run typecheck (root or radar-ui).

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOG="$REPO_ROOT/.typecheck-log"

# Write a self-contained check script to a temp file so nohup has no quoting issues
CHKSCRIPT="$(mktemp /tmp/metrivant-typecheck-XXXXXX.sh)"
cat > "$CHKSCRIPT" << SCRIPT_EOF
#!/bin/sh
echo "=== TypeScript check started $(date) ===" > "$LOG"
cd "$REPO_ROOT"          && npm run typecheck >> "$LOG" 2>&1 && echo "[backend] PASS" >> "$LOG" || echo "[backend] FAIL — see $LOG" >> "$LOG"
cd "$REPO_ROOT/radar-ui" && npm run typecheck >> "$LOG" 2>&1 && echo "[ui]      PASS" >> "$LOG" || echo "[ui]      FAIL — see $LOG" >> "$LOG"
echo "=== check complete ===" >> "$LOG"
rm -f "$CHKSCRIPT"
SCRIPT_EOF

chmod +x "$CHKSCRIPT"
nohup "$CHKSCRIPT" > /dev/null 2>&1 &

echo "[pre-push] TypeScript checks running in background — results: .typecheck-log"
exit 0
`;

fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
console.log("✓ pre-push hook installed (.git/hooks/pre-push)");
