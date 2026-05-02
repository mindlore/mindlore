---
name: mindlore-stats
description: Show context contribution and cost per session — hook calls, durations, DB stats.
effort: low
context: fork
allowed-tools: [Bash, Read]
---

## Script Resolution

Resolve `MINDLORE_DIR` (active knowledge base directory) using:
1. If project `.mindlore/` exists → use it
2. Else → use `~/.mindlore/`

# /mindlore-stats

Show context contribution and cost per session — hook calls, durations, DB stats.

## Trigger

User says "mindlore stats", "stats", "context cost", "hook performance", "ne kadar yer kaplıyor".

## Execution

### 1. Telemetry Analysis

Read `$MINDLORE_DIR/telemetry.jsonl` (each line is a JSON object):

```bash
# Count lines and read last 500 for session estimate
wc -l "$MINDLORE_DIR/telemetry.jsonl"
tail -500 "$MINDLORE_DIR/telemetry.jsonl"
```

Parse each line as JSON with fields: `hook` (string), `duration` (number, ms), `ts` (ISO timestamp), optionally `injectSize` (number, chars).

Calculate:
- **Total hook calls (all time)**: total line count
- **Hook calls (session)**: lines where `ts` is within last 8 hours
- **Avg duration per hook**: group by `hook`, compute mean `duration`
- **Session inject avg**: from events where `hook === "mindlore-session-focus"`, average `injectSize` (chars ÷ 4 ≈ tokens)
- **Search inject avg**: from events where `hook === "mindlore-search"`, average `injectSize` (chars ÷ 4 ≈ tokens)

### 2. DB Stats

Query `$MINDLORE_DIR/mindlore.db`:

```bash
# Indexed docs
node -e "
const DB = require('better-sqlite3');
const db = new DB('$MINDLORE_DIR/mindlore.db', {readonly:true});
const total = db.prepare('SELECT COUNT(*) as n FROM file_hashes').get().n;
const stale = db.prepare(\"SELECT COUNT(*) as n FROM file_hashes WHERE last_indexed < datetime('now','-30 days')\").get().n;
const epRows = db.prepare('SELECT kind, COUNT(*) as n FROM episodes GROUP BY kind').all();
const sessions = db.prepare('SELECT COUNT(*) as n FROM mindlore_fts_sessions').get()?.n ?? 'N/A';
console.log(JSON.stringify({total, stale, epRows, sessions}));
db.close();
"
```

Get DB file size:

```bash
node -e "const fs=require('fs'); const s=fs.statSync('$MINDLORE_DIR/mindlore.db'); console.log((s.size/1024/1024).toFixed(2)+' MB');"
```

### 3. Format Output

Print a compact stats table:

```
## Mindlore Stats

| Metric | Value |
|--------|-------|
| DB Size | X MB |
| Indexed Docs | N |
| Stale Docs (30d+) | N |
| Episodes (active) | N |
| Hook Calls (session) | N |
| Hook Calls (all time) | N |
| Avg Hook Duration | Xms |
| Session Inject Avg | ~N tokens |
| Search Inject Avg | ~N tokens |
```

Then add a per-hook breakdown if hook calls > 0:

```
### Hook Breakdown (session)

| Hook | Calls | Avg Duration |
|------|-------|-------------|
| mindlore-session-focus | N | Xms |
| mindlore-search | N | Xms |
| ... | | |
```

## Notes

- If `telemetry.jsonl` does not exist: report "No telemetry data yet"
- If `mindlore.db` does not exist: report "DB not found — run `npx mindlore init`"
- If `episodes` table missing: skip episode count, show "—"
- Inject size in tokens is approximate (chars ÷ 4)
- "Session" = last 8 hours from current time
