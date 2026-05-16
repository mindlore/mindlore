#!/bin/bash
# Post-publish retry: runs $CMD up to $MAX_ATTEMPTS, captures output to $OUT_LOG.
# Usage: post-publish-retry.sh "<cmd>" "<output-log-path>"
set -o pipefail
CMD="$1"
OUT_LOG="${2:-/tmp/post-publish.log}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-5}"
SLEEP_BETWEEN="${SLEEP_BETWEEN:-10}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if bash -c "$CMD" > "$OUT_LOG" 2>&1; then
    echo "post-publish-retry: success on attempt $attempt"
    tail -5 "$OUT_LOG"
    exit 0
  fi
  echo "post-publish-retry: attempt $attempt failed"
  tail -5 "$OUT_LOG"
  [ "$attempt" -lt "$MAX_ATTEMPTS" ] && sleep "$SLEEP_BETWEEN"
done
echo "post-publish-retry: all $MAX_ATTEMPTS attempts failed"
exit 1
