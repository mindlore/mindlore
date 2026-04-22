---
name: mindlore-reflect
description: Pattern extraction from episodes — 3-tier confidence, nomination pipeline, CLAUDE.md update proposals.
context: fork
---

## Script Resolution

Resolve `MINDLORE_PKG` (package root) using one of these methods, in order:
1. If CC injected "Base directory for this skill: /path/to/skills/mindlore-reflect" → `MINDLORE_PKG = {base_directory}/../..`
2. Fallback: run `node -e "console.log(require('path').join(require('child_process').execSync('npm root -g',{encoding:'utf8'}).trim(),'mindlore')))"`

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

## Quick Health Summary (v0.5.3)

After pattern extraction, run quick SQL checks (0 token, <1ms):
```bash
node -e "
  const db = require('better-sqlite3')(require('path').join(require('os').homedir(), '.mindlore', 'mindlore.db'), {readonly:true});
  const stale = db.prepare(\"SELECT COUNT(*) as c FROM file_hashes WHERE recall_count = 0 AND archived_at IS NULL AND last_indexed < datetime('now','-60 days')\").get()?.c ?? 0;
  const raw = db.prepare(\"SELECT COUNT(*) as c FROM episodes WHERE (consolidation_status = 'raw' OR consolidation_status IS NULL) AND kind IN ('learning','discovery','friction','decision')\").get()?.c ?? 0;
  console.log(JSON.stringify({stale, raw}));
  db.close();
"
```

Rapor sonuna ekle:
```
Stale: {stale} doc | Raw episodes: {raw} | → Detay: /mindlore-maintain
```

## Rules

- NEVER write learnings or nominations without user approval
- Group related patterns into existing topic files
- Reflect READS episodes, diary WRITES episodes — clear separation
- Mark processed episodes so future reflect skips them
- Append to `log.md`: `| {date} | reflect | {N} episodes processed, {M} learnings written |`
