---
name: mindlore-diary
description: LLM-powered session analysis — decisions, discoveries, frictions, learnings. Promotes episodes to semantic knowledge.
context: fork
---

## Script Resolution

Resolve `MINDLORE_PKG` (package root) using one of these methods, in order:
1. If CC injected "Base directory for this skill: /path/to/skills/mindlore-diary" → `MINDLORE_PKG = {base_directory}/../..`
2. Fallback: run `node -e "console.log(require('path').join(require('child_process').execSync('npm root -g',{encoding:'utf8'}).trim(),'mindlore')))"`

Use: `node "$MINDLORE_PKG/dist/scripts/..."` for all script commands.

# /mindlore-diary

## Scope

Determine target using `getActiveMindloreDir()` logic:
- If CWD has `.mindlore/` -> project scope
- Otherwise -> global `~/.mindlore/`

## Trigger

`/mindlore-diary` or `/mindlore-log diary`

## On Start — Read skill_memory

```bash
node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" get mindlore-diary last_diary_date
```
If last_diary_date is today, warn: "Diary already ran today. Continue anyway?"

## Flow

1. Read active episodes: `WHERE status = 'active' AND source IN ('hook', 'diary')`
2. Filter by time: default last 24h, or `--days N` flag
3. Present summary: "Found N episodes spanning DATE1 to DATE2"
4. LLM analyzes episodes for semantic patterns:
   - **Decisions:** choices made, alternatives considered
   - **Discoveries:** new insights, broken assumptions
   - **Frictions:** recurring blockers, errors, slowdowns
   - **Learnings:** techniques that worked, patterns validated
   - **Preferences:** user workflow preferences detected
   - **Events:** notable milestones, completions

5. For each detected item, create enriched episode:
   ```sql
   INSERT INTO episodes (summary, body, kind, source, status, project, created_at)
   VALUES (?, ?, ?, 'diary', 'active', ?, ?)
   ```
   Where kind = 'decision' | 'discovery' | 'friction' | 'learning' | 'preference' | 'event'

6. Output structured report:
   ```
   -- Diary Raporu ({date}, {N} episode analiz edildi) --

   Decisions ({count}):
     - {summary}

   Discoveries ({count}):
     - {summary}

   Frictions ({count}):
     - {summary}

   Learnings ({count}):
     - {summary}

   {M} yeni episode olusturuldu.
   ```

## On End — Write skill_memory

```bash
node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" set mindlore-diary last_diary_date "$(date -I)"
node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" set mindlore-diary last_episode_count "{N}"
```

## Rules

- NEVER create episodes without user seeing the analysis first
- Each episode must have proper `kind` field — don't default everything to 'event'
- Group related items — don't create 5 episodes for the same friction
- Append to `log.md`: `| {date} | diary | {N} episodes created |`
