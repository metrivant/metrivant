#!/usr/bin/env bash
# check-surface-deps.sh
# Scans each deployment surface for imports not declared in its own package.json.
# Warns only — does not block execution.
#
# Usage: bash scripts/check-surface-deps.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WARN=0

# ── Helpers ────────────────────────────────────────────────────────────────────

declared_deps() {
  node -e "
    const p = require('$1');
    const all = { ...p.dependencies, ...p.devDependencies };
    Object.keys(all).forEach(k => console.log(k));
  " 2>/dev/null
}

# Extract bare module names from import/require statements only.
# Matches: from "pkg" | from 'pkg' | require("pkg") | require('pkg')
# Excludes relative paths (./ and ../) and absolute paths (/).
scan_imports() {
  local dirs=()
  for d in "$@"; do [[ -d "$d" ]] && dirs+=("$d"); done
  [[ ${#dirs[@]} -eq 0 ]] && return 0

  {
    # import ... from "pkg"
    grep -roh \
      --include="*.ts" --include="*.tsx" --include="*.js" \
      --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir=".turbo" \
      -E 'from "[^./"!][^"]*"' \
      "${dirs[@]}" 2>/dev/null \
    | grep -oE '"[^"]*"' | tr -d '"'

    # import ... from 'pkg'
    grep -roh \
      --include="*.ts" --include="*.tsx" --include="*.js" \
      --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir=".turbo" \
      -E "from '[^./'!][^']*'" \
      "${dirs[@]}" 2>/dev/null \
    | grep -oE "'[^']*'" | tr -d "'"

    # require("pkg")
    grep -roh \
      --include="*.ts" --include="*.tsx" --include="*.js" \
      --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir=".turbo" \
      -E 'require\("[^./"!][^"]*"\)' \
      "${dirs[@]}" 2>/dev/null \
    | grep -oE '"[^"]*"' | tr -d '"'
  } | sort -u
}

root_pkg() {
  # Extract the package name root (handles @scope/pkg and pkg/subpath)
  local imp="$1"
  if [[ "$imp" == @* ]]; then
    echo "$imp" | cut -d/ -f1-2
  else
    echo "$imp" | cut -d/ -f1
  fi
}

is_declared() {
  local root
  root=$(root_pkg "$1")
  shift
  local deps=("$@")
  for dep in "${deps[@]}"; do
    [[ "$dep" == "$root" ]] && return 0
  done
  return 1
}

is_builtin() {
  # Node.js built-ins — never declared in package.json
  [[ "$1" == node:* ]] && return 0
  case "$1" in
    assert|async_hooks|buffer|child_process|cluster|console|constants|crypto|\
dgram|diagnostics_channel|dns|domain|events|fs|http|http2|https|inspector|\
module|net|os|path|perf_hooks|process|punycode|querystring|readline|repl|\
stream|string_decoder|timers|tls|trace_events|tty|url|util|v8|vm|\
worker_threads|zlib)
      return 0 ;;
  esac
  return 1
}

is_framework_implicit() {
  case "$1" in
    next|react|react-dom|server-only) return 0 ;;
  esac
  [[ "$1" == next/* || "$1" == react/* ]] && return 0
  return 1
}

# ── Runtime surface ─────────────────────────────────────────────────────────────

echo ""
echo "── RUNTIME SURFACE (api/, lib/) ──────────────────────────────────────────"

mapfile -t RUNTIME_DEPS < <(declared_deps "$REPO_ROOT/package.json")

RUNTIME_MISSING=()
while IFS= read -r imp; do
  [[ -z "$imp" ]] && continue
  is_builtin "$imp" && continue
  is_framework_implicit "$imp" && continue
  is_declared "$imp" "${RUNTIME_DEPS[@]}" || RUNTIME_MISSING+=("$imp")
done < <(scan_imports "$REPO_ROOT/api" "$REPO_ROOT/lib")

if [[ ${#RUNTIME_MISSING[@]} -eq 0 ]]; then
  echo "  ✓ All imports satisfied by root package.json"
else
  echo "  ⚠ Imports not found in root package.json:"
  for m in "${RUNTIME_MISSING[@]}"; do echo "    - $m"; done
  WARN=1
fi

# ── Frontend surface ────────────────────────────────────────────────────────────

echo ""
echo "── FRONTEND SURFACE (radar-ui/) ───────────────────────────────────────────"

mapfile -t FRONTEND_DEPS < <(declared_deps "$REPO_ROOT/radar-ui/package.json")

FRONTEND_MISSING=()
while IFS= read -r imp; do
  [[ -z "$imp" ]] && continue
  is_builtin "$imp" && continue
  is_framework_implicit "$imp" && continue
  is_declared "$imp" "${FRONTEND_DEPS[@]}" || FRONTEND_MISSING+=("$imp")
done < <(scan_imports "$REPO_ROOT/radar-ui")

if [[ ${#FRONTEND_MISSING[@]} -eq 0 ]]; then
  echo "  ✓ All imports satisfied by radar-ui/package.json"
else
  echo "  ⚠ Imports not found in radar-ui/package.json:"
  for m in "${FRONTEND_MISSING[@]}"; do echo "    - $m"; done
  WARN=1
fi

echo ""

if [[ $WARN -eq 0 ]]; then
  echo "All surfaces clean."
else
  echo "⚠  Warning: missing deps above — add to the correct package.json before pushing."
  echo "   This script does not block execution."
fi

echo ""
exit 0
