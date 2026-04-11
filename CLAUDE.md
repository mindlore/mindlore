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
hooks/      # CC lifecycle hooks (9 in v0.2, 11 total roadmap)
skills/     # LLM agent skills (5 in v0.2, 7 total roadmap)
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

## Hooks (v0.3)

| Event | Hook | Purpose |
|-------|------|---------|
| SessionStart | mindlore-session-focus | Inject last delta + INDEX |
| UserPromptSubmit | mindlore-search | FTS5 search, max 3 results, tags inject |
| UserPromptSubmit | mindlore-decision-detector | TR+EN decision signal detection |
| FileChanged | mindlore-index | Sync changed .md to FTS5 |
| FileChanged | mindlore-fts5-sync | Incremental re-index |
| SessionEnd | mindlore-session-end | Structured delta + global git sync |
| PreCompact | mindlore-pre-compact | Delta + FTS5 flush |
| PostCompact | mindlore-post-compact | Re-inject context |
| PreToolUse (Read) | mindlore-read-guard | Repeated-read warning + token display |
| PostToolUse (Read) | mindlore-post-read | Token estimation per file read |
| PreToolUse (Write\|Edit) | mindlore-dont-repeat | LESSONS/learnings rule enforcement |
| CwdChanged | mindlore-cwd-changed | Scope detection + _scope.json write |

## Skills (v0.3)

| Skill | Purpose |
|-------|---------|
| /mindlore-ingest | Add knowledge (URL, text, file, PDF) + 6-point quality gate |
| /mindlore-health | 18-point structural health check |
| /mindlore-query | Search, ask, stats, brief — compounding pipeline |
| /mindlore-log | Session logging, reflect, status, wiki save |
| /mindlore-decide | Record and list decisions with supersedes chain |
| /mindlore-evolve | Knowledge schema co-evolution — scan + suggest updates |
| /mindlore-explore | Discover unexpected connections between sources |

## Testing

```bash
npm test                    # all suites
npx jest tests/fts5.test.cjs  # specific suite
```

18 active suites in v0.3: fts5, dedup, init, frontmatter, hook-smoke, uninstall, search-hook, session-focus, compounding, decision, read-guard, log, global-layer, cwd-changed, dont-repeat, post-read, upgrade, schemas.

## Planlama Referansları

Yeni versiyon planlarken bu dosyalara bakılmalı:

- **Sentez:** `~/.claude/knowledge/analyses/2026-04-08-second-brain-architecture-decision.md` — 30+ karar, implementasyon durumu tablosu (YAPILDI/BEKLİYOR), versiyon roadmap
- **Plan v0.1:** `~/.claude/plans/elegant-juggling-balloon.md` — v0.0.1 implementasyon detayları, düzeltilen buglar
- **Plan v0.2:** `~/.claude/plans/mindlore-v020.md` — 9 faz, 29 dosya, compounding + karar takibi + session memory
- **MEMORY:** `~/.claude/projects/C--Users-Omrfc-Documents-kastell/memory/MEMORY.md` — Mindlore bölümü, sonraki session yönlendirmesi
