#!/bin/bash
set -euo pipefail
SCRIPT="$(dirname "$0")/../scripts/post-publish-retry.sh"
OUT_LOG=$(mktemp)
trap 'rm -f "$OUT_LOG"' EXIT
export MAX_ATTEMPTS=2 SLEEP_BETWEEN=0  # keep tests fast — don't sleep, fail quickly

# Test 1: success on first try → exit 0
if bash "$SCRIPT" "echo success" "$OUT_LOG"; then
  echo "PASS test 1"
else
  echo "FAIL test 1: expected exit 0"; exit 1
fi

# Test 2: success on 2nd attempt → exit 0
ATTEMPT_FILE=$(mktemp); echo 0 > "$ATTEMPT_FILE"
CMD="n=\$(cat $ATTEMPT_FILE); echo \$((n+1)) > $ATTEMPT_FILE; [ \$n -ge 1 ]"
if bash "$SCRIPT" "$CMD" "$OUT_LOG"; then
  echo "PASS test 2"
else
  echo "FAIL test 2: expected exit 0 after retries"; exit 1
fi
rm -f "$ATTEMPT_FILE"

# Test 3: all retries fail → non-zero exit
if bash "$SCRIPT" "false" "$OUT_LOG"; then
  echo "FAIL test 3: expected non-zero exit"; exit 1
else
  echo "PASS test 3"
fi
