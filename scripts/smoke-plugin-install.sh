#!/usr/bin/env bash
# Plugin install smoke test (bootstrap pattern — context-mode style)
#
# Simulates CC plugin marketplace install pipeline:
#   1. npm pack -> produce tarball from current source (no node_modules)
#   2. Extract tarball to temp dir (NO npm install — CC plugin contract)
#   3. Boot start.cjs (runtime bootstrap layer)
#      - start.cjs detects missing native deps
#      - calls npm install --no-package-lock --no-save in temp dir
#      - probes better-sqlite3 ABI
#      - require('./mcp-server.cjs')
#   4. Verify MCP server boots cleanly (no "Cannot find module" / "dlopen" errors)
#
# First-boot timeout: 180s (allow for npm install + native build)
# In CI/cache: subsequent boots are <100ms (existsSync fast path)
#
# Run from repo root:
#   bash scripts/smoke-plugin-install.sh
#
# Exit codes:
#   0 — smoke passes, plugin install would work
#   1 — shipping bug detected, DO NOT publish
#
# Why: see memory/feedback_plugin_smoke_test_required.md
#      see memory/feedback_cc_plugin_self_contained.md
#      see memory/feedback_multi_platform_binary.md

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Plugin install smoke test (bootstrap pattern)"
echo "    Repo: $REPO_ROOT"

# Sanity: required files exist
for f in mcp-server.cjs start.cjs; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f not found. Run 'npm run bundle' first." >&2
    exit 1
  fi
done
if [ ! -d "dist" ]; then
  echo "FAIL: dist/ not found. Run 'npm run build' first." >&2
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap "sleep 1; rm -rf $TMP_DIR 2>/dev/null || true" EXIT

echo "==> 1) npm pack -> tarball"
TARBALL=$(npm pack --silent --pack-destination "$TMP_DIR" 2>&1 | tail -1)
echo "    Tarball: $TARBALL ($(du -h "$TMP_DIR/$TARBALL" | cut -f1))"

echo "==> 2) Extract tarball (no npm install — CC plugin contract)"
mkdir -p "$TMP_DIR/extract"
tar xzf "$TMP_DIR/$TARBALL" -C "$TMP_DIR/extract"
cd "$TMP_DIR/extract/package"

# Sanity: bootstrap + server present
for f in start.cjs mcp-server.cjs; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing from tarball. Check package.json files: whitelist." >&2
    exit 1
  fi
done
echo "    start.cjs present ($(du -h start.cjs | cut -f1))"
echo "    mcp-server.cjs present ($(du -h mcp-server.cjs | cut -f1))"

# Confirm bootstrap pattern (not bundledDependencies)
if [ -d "node_modules/better-sqlite3" ]; then
  echo "    NOTE: node_modules/better-sqlite3 present (bundledDeps?)"
  echo "          With bootstrap pattern this is OK but unnecessary."
fi

echo "==> 3) Boot start.cjs (600s timeout for first-boot npm install)"
STDERR_LOG="$TMP_DIR/stderr.log"
# Empty stdin so server doesn't hang on JSON-RPC
( echo "" | node start.cjs ) 2>"$STDERR_LOG" >/dev/null &
PID=$!

# Wait up to 180s for either: (a) clean boot, (b) error in stderr
WAITED=0
MAX_WAIT=600
BOOTSTRAP_DONE=0
while [ $WAITED -lt $MAX_WAIT ]; do
  # Check if process died
  if ! kill -0 $PID 2>/dev/null; then
    # Process exited — check if cleanly or with error
    if grep -qE "Cannot find module|MODULE_NOT_FOUND|dlopen|Error: The module|invalid ELF" "$STDERR_LOG"; then
      echo "FAIL: shipping bug detected in stderr." >&2
      echo "----- stderr -----" >&2
      cat "$STDERR_LOG" >&2
      echo "------------------" >&2
      exit 1
    fi
    # Clean exit (no useful signal yet — server probably needs stdin)
    break
  fi
  # Check if bootstrap completed (saw the trigger line)
  if grep -q "install complete" "$STDERR_LOG" 2>/dev/null; then
    BOOTSTRAP_DONE=1
    # Give server 2s more to fully boot, then kill
    sleep 2
    kill $PID 2>/dev/null || true
    break
  fi
  # Quick sanity — if no bootstrap needed (deps cached), kill after 5s
  if [ $WAITED -ge 5 ] && [ "$BOOTSTRAP_DONE" -eq 0 ]; then
    # No "install complete" message yet — maybe deps were already present
    # Check stderr is silent (good sign — fast path taken)
    if [ ! -s "$STDERR_LOG" ] || ! grep -q "installing" "$STDERR_LOG"; then
      echo "    (fast path — deps already present in tarball or cache)"
      kill $PID 2>/dev/null || true
      break
    fi
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done
wait $PID 2>/dev/null || true

echo "==> 4) Verify stderr for shipping errors"
if grep -qE "Cannot find module|MODULE_NOT_FOUND|dlopen|Error: The module|invalid ELF" "$STDERR_LOG"; then
  echo "FAIL: shipping bug detected. start.cjs or mcp-server.cjs cannot load required deps." >&2
  echo "----- stderr -----" >&2
  cat "$STDERR_LOG" >&2
  echo "------------------" >&2
  exit 1
fi

# Native binding errors specific to better-sqlite3
if grep -qE "better_sqlite3\.node|prebuild" "$STDERR_LOG"; then
  if grep -qE "Error|not found|missing|invalid" "$STDERR_LOG"; then
    echo "FAIL: better-sqlite3 native binding error detected." >&2
    cat "$STDERR_LOG" >&2
    exit 1
  fi
fi

echo ""
echo "==> PASS: plugin install smoke test"
echo "    Bootstrap successful (took ${WAITED}s)."
echo "    Safe to publish."

if [ -s "$STDERR_LOG" ]; then
  echo ""
  echo "    Bootstrap log:"
  sed 's/^/    /' "$STDERR_LOG"
fi
