---
name: mindlore-diary
description: LLM-powered session analysis — decisions, discoveries, frictions, learnings. Promotes episodes to semantic knowledge.
---

## Script Resolution

All script paths are relative to this skill's package root.
Package root = 2 directories up from this skill's base directory.

When CC loads this skill, it shows "Base directory for this skill: /path/to/skills/mindlore-diary".
Compute: `MINDLORE_PKG = {base_directory}/../..`
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
