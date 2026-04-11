# Mindlore

AI-native knowledge system for Claude Code.

## Tech Stack

Node.js (CJS), better-sqlite3 (FTS5), Jest, ESLint

## Commands

```bash
npm test           # jest --config jest.config.cjs
npm run lint       # eslint scripts/ hooks/ tests/
npm run health     # mindlore-health-check.cjs
npm run index      # mindlore-fts5-index.cjs (full re-index)
npm run search     # mindlore-fts5-search.cjs "query"
```

## Architecture

Hybrid: deterministic work in CJS scripts, intelligent work in MD skills.

```
scripts/    # Deterministic (health check, FTS5 index/search, init)
hooks/      # CC lifecycle hooks (7 in v0.1, 11 total roadmap)
skills/     # LLM agent skills (2 in v0.1, 7 total roadmap)
templates/  # Init copies these to .mindlore/
tests/      # Jest test suites
```

## Key Conventions

- All scripts and hooks use `.cjs` extension (CommonJS)
- FTS5 database: `.mindlore/mindlore.db`
- Content-hash dedup: SHA256, skip unchanged files on re-index
- Frontmatter: 9 types = 9 directories (see SCHEMA.md)
- Hook prefix: `mindlore-` (avoid collisions with user hooks)
- Hooks inject via `stdout` (CC ignores stderr for additionalContext)
- Shared modules: `hooks/lib/mindlore-common.cjs`, `scripts/lib/constants.cjs`, `tests/helpers/db.cjs`
- `plugin.json` for CC plugin manifest (npx skills add)
- Uninstall: `npx mindlore uninstall [--all]`

## Hooks (v0.1)

| Event | Hook | Purpose |
|-------|------|---------|
| SessionStart | mindlore-session-focus | Inject last delta + INDEX |
| UserPromptSubmit | mindlore-search | FTS5 search, max 3 results |
| FileChanged | mindlore-index | Sync changed .md to FTS5 |
| FileChanged | mindlore-fts5-sync | Incremental re-index |
| SessionEnd | mindlore-session-end | Write delta to diary/ |
| PreCompact | mindlore-pre-compact | Delta + FTS5 flush |
| PostCompact | mindlore-post-compact | Re-inject context |

## Skills (v0.1)

| Skill | Purpose |
|-------|---------|
| /mindlore-ingest | Add knowledge (URL, text, file, PDF) |
| /mindlore-health | 16-point structural health check |

## Testing

```bash
npm test                    # all suites
npx jest tests/fts5.test.cjs  # specific suite
```

8 active suites in v0.1: fts5, dedup, init, frontmatter, hook-smoke, uninstall, search-hook, session-focus.
compounding.test.cjs is v0.2 (skipped in v0.1).

## Planlama Referansları

Yeni versiyon planlarken bu dosyalara bakılmalı:

- **Sentez:** `~/.claude/knowledge/analyses/2026-04-08-second-brain-architecture-decision.md` — 30+ karar, implementasyon durumu tablosu (YAPILDI/BEKLİYOR), versiyon roadmap
- **Plan:** `~/.claude/plans/elegant-juggling-balloon.md` — v0.0.1 implementasyon detayları, düzeltilen buglar, v0.1.0 kalan 6 madde
- **MEMORY:** `~/.claude/projects/C--Users-Omrfc-Documents-kastell/memory/MEMORY.md` — Mindlore bölümü, sonraki session yönlendirmesi
