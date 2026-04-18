---
name: mindlore-reflect
description: Pattern extraction from episodes — 3-tier confidence, nomination pipeline, CLAUDE.md update proposals.
---

## Script Resolution

All script paths are relative to this skill's package root.
Package root = 2 directories up from this skill's base directory.

When CC loads this skill, it shows "Base directory for this skill: /path/to/skills/mindlore-reflect".
Compute: `MINDLORE_PKG = {base_directory}/../..`
Use: `node "$MINDLORE_PKG/dist/scripts/..."` for all script commands.

# /mindlore-reflect

## Scope

Scans both project + global `~/.mindlore/` diary/ for patterns.

## Trigger

`/mindlore-reflect` or `/mindlore-log reflect`

## On Start — Check pending nominations + skill_memory

```bash
node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" get mindlore-reflect last_reflect_date
node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" get mindlore-reflect nomination_count
```

Check pending nominations:
```sql
SELECT id, summary, body, created_at FROM episodes
WHERE kind = 'nomination' AND status = 'staged' AND project = ?
ORDER BY created_at ASC
```

If pending nominations exist, present them first:
```
-- Bekleyen Nomination'lar ({N} adet) --
1. "{summary}" (staged {days} gun once)
   Target: learnings | Confidence: 3x

Onaylamak istediklerini sec, veya 'skip':
```

## Flow

1. Read active episodes: `WHERE status = 'active' AND source IN ('hook', 'diary')`
2. Filter by time: `--days 7` (default), `--days 30`
3. Present summary: "Found N episodes spanning DATE1 to DATE2"
4. LLM analyzes episodes for recurring patterns:
   - Repeated decisions (same choice 2+ times)
   - Recurring frictions (same blocker/error)
   - Discovery patterns (assumptions that keep breaking)
   - Workflow patterns that worked well

5. **3-Tier Confidence Assessment:**

   | Tekrar | Tier | Aksiyon |
   |--------|------|---------|
   | 1x | Note | Sessiz — episode olarak kalir, raporda goster |
   | 2x | Learning | `kind: learning` episode olustur, learnings/ dosyasina yaz |
   | 3x+ | Nomination | `kind: nomination, status: staged, source: reflect` episode olustur |

6. **Structured report:**
   ```
   -- Reflect Raporu (son {days} gun, {N} episode) --

   Friction ({count}):
     - {summary} — {repeat_count}x tekrar

   Discoveries ({count}):
     - {summary}

   Patterns:
     - "{pattern}" -> 3x tekrar -> NOMINATION (staged)
     - "{pattern}" -> 2x tekrar -> LEARNING
     - "{pattern}" -> 1x -> NOTE

   Onerilen:
     [ ] {rule} ({repeat_count}x, {confidence} confidence)
   ```

7. **Nomination creation (3x+ tekrar):**
   ```sql
   INSERT INTO episodes (summary, body, kind, status, source, project, created_at)
   VALUES (?, ?, 'nomination', 'staged', 'reflect', ?, ?)
   ```

8. **Nomination approval flow:**
   User approves -> `status: staged -> approved` -> write to target:
   - `learnings` -> `learnings/{topic}.md`
   - `claude.md` -> project CLAUDE.md'ye kural ekle
   - `domain:{slug}` -> ilgili domain sayfasina ekle

   User rejects -> `status: staged -> rejected` + rejection reason

## On End — Write skill_memory

```bash
node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" set mindlore-reflect last_reflect_date "$(date -I)"
node "$MINDLORE_PKG/dist/scripts/lib/skill-memory.js" set mindlore-reflect nomination_count "{staged_count}"
```

## Rules

- NEVER write learnings or nominations without user approval
- Group related patterns into existing topic files
- Reflect READS episodes, diary WRITES episodes — clear separation
- Mark processed episodes so future reflect skips them
- Append to `log.md`: `| {date} | reflect | {N} episodes processed, {M} learnings written |`
