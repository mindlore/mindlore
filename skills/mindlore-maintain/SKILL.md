---
name: mindlore-maintain
description: KB maintenance — decay/archive, episode consolidation, contradiction detection
effort: medium
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
---

## Script Resolution

All script paths are relative to this skill's package root.
Package root = 2 directories up from this skill's base directory.

When CC loads this skill, it shows "Base directory for this skill: /path/to/skills/mindlore-maintain".
Compute: `MINDLORE_PKG = {base_directory}/../..`
Use: `node "$MINDLORE_PKG/dist/scripts/..."` for all script commands.

# /mindlore-maintain

KB bakım skill'i. Reflect düşünür, maintain temizler.

## Trigger

- `/mindlore-maintain` — full rapor (decay + consolidation + contradiction)
- `/mindlore-maintain decay` — stale doc listesi + archive flow
- `/mindlore-maintain consolidate` — episode gruplama + dosyaya promote
- `/mindlore-maintain contradictions` — çelişki analizi

## Decay Mode

1. Stale documents listele:
   ```bash
   DECAY_MOD="$MINDLORE_PKG/dist/scripts/lib/decay.js"
   node -e "
     const { listStaleDocuments } = require(process.argv[1]);
     const Database = require('better-sqlite3');
     const path = require('path'), os = require('os');
     const dbPath = path.join(os.homedir(), '.mindlore', 'mindlore.db');
     const db = new Database(dbPath, {readonly: true});
     const stale = listStaleDocuments(db);
     console.log(JSON.stringify(stale, null, 2));
     db.close();
   " "$DECAY_MOD"
   ```

2. Rapor sun:
   ```
   -- Decay Report --
   | # | File | Score | Last Access | Recalls | Action |
   |---|------|-------|-------------|---------|--------|
   | 1 | sources/old-api.md | 0.12 | 2025-11-01 | 0 | Archive? |
   ```

3. Kullanıcı onaylarsa:
   a. Git snapshot: `createPreEvictionTag`
   b. Arşivle: `archiveDocument(db, path)`
   c. Rapor: "Archived N docs. Git tag: pre-eviction-2026-04-18. Restore: `/mindlore-maintain restore <path>`"

**Kurallar:**
- Onay almadan ARŞİVLEME
- Arşiv öncesi HER ZAMAN git snapshot
- Score + last access + recall count göster

## Consolidation Mode

1. Raw episode sayısını kontrol et
2. Gruplama önerisi sun:
   ```
   -- Consolidation Önerisi --
   3 learning episode → learnings/typescript-strict-patterns.md
   2 discovery episode → insights/sqlite-vec-windows-gotchas.md
   ```

3. Kind→dizin mapping (deterministik):
   - learning → `learnings/`
   - discovery → `insights/`
   - friction → `analyses/`
   - decision → `decisions/`
   - preference → CC memory'de var mı kontrol et, varsa skip, yoksa `learnings/`

4. Kullanıcı onaylarsa:
   a. Hedef dosya yaz (frontmatter zorunlu: consolidated_from, consolidated_at, kind_source)
   b. Episode'ları işaretle: `markConsolidated(db, ids, targetFile)`
   c. Rapor: "N episode → M dosya promote edildi"

**Kurallar:**
- session/event episode'ları CONSOLİDATE EDİLMEZ
- Onay almadan dosya YAZMA
- `consolidated_from` frontmatter ZORUNLU (provenance)

## Contradiction Mode

1. Deterministic wiki-lint:
   ```bash
   node "$MINDLORE_PKG/dist/scripts/mindlore-health-check.js" ~/.mindlore 2>/dev/null | grep -A 5 'contradiction'
   ```

2. Semantic analiz (opsiyonel, token harcar)

**Kurallar:**
- Deterministic check HER ZAMAN çalışır
- Çelişkileri OTOMATİK düzeltme — kullanıcıya sor

## Full Report Mode (flagsız)

```
-- Maintain Report --
Decay: 3 stale document (score < 0.3)
Consolidation: 52 raw episode (learning: 15, discovery: 8, friction: 4)
Contradictions: 1 found

Aksiyon için:
  /mindlore-maintain decay
  /mindlore-maintain consolidate
  /mindlore-maintain contradictions
```

## Restore Mode

`/mindlore-maintain restore <path>` — arşivlenmiş dokümanı geri yükler.
