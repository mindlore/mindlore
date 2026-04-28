# Mindlore

AI-native knowledge system for Claude Code.

## Tech Stack

TypeScript (CJS output), better-sqlite3 (FTS5), Jest, ESLint

## Commands

```bash
npm test           # jest --config jest.config.cjs
npm run lint       # eslint scripts/ hooks/ tests/
npm run health     # dist/scripts/mindlore-health-check.js
npm run index      # dist/scripts/mindlore-fts5-index.js (full re-index)
npm run search     # dist/scripts/mindlore-fts5-search.js "query"
npm run doctor     # dist/scripts/mindlore-doctor.js (7-point runtime check)
npm run perf       # dist/scripts/mindlore-perf.js (hook latency report)
```

## Architecture

Hybrid: deterministic work in CJS scripts, intelligent work in MD skills.

```
scripts/    # Deterministic (health check, FTS5 index/search, init)
hooks/      # CC lifecycle hooks (14 in v0.6.0)
skills/     # LLM agent skills (10 in v0.5.4)
templates/  # Init copies these to .mindlore/
tests/      # Jest test suites
```

## Key Conventions

- Scripts use `.ts` (source) / `.js` (dist), hooks use `.cjs` (CommonJS)
- FTS5 database: `.mindlore/mindlore.db` (v0.6.1: `mindlore_fts` knowledge + `mindlore_fts_sessions` sessions)
- Content-hash dedup: SHA256, skip unchanged files on re-index
- Frontmatter: 11 directories (see SCHEMA.md)
- Hook prefix: `mindlore-` (avoid collisions with user hooks)
- Hooks inject via `stdout` (CC ignores stderr for additionalContext)
- Shared modules: `hooks/lib/mindlore-common.cjs`, `scripts/lib/constants.ts`, `tests/helpers/db.ts`
- `plugin.json` for CC plugin manifest (npx skills add)
- Uninstall: `npx mindlore uninstall [--all]`

## Hooks (v0.6.0 — 14 hooks)

> v0.6.0: Tüm hook'lar `withTelemetry` / `withTelemetrySync` ile sarmalandı (`.mindlore/telemetry.jsonl`).

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
| PreToolUse (Agent) | mindlore-model-router | Cost-optimized model routing via markers |
| PreToolUse (Agent) | mindlore-research-guard | FTS5 check before research — block if recent+high quality exists |

## Skills (v0.5.4 — 10 skills)

| Skill | Purpose |
|-------|---------|
| /mindlore-ingest | Add knowledge (URL, text, file, PDF) + 6-point quality gate |
| /mindlore-health | 16-point structural health check |
| /mindlore-query | Search, ask, stats, brief — compounding pipeline |
| /mindlore-log | Session logging, reflect, status, wiki save |
| /mindlore-decide | Record and list decisions with supersedes chain |
| /mindlore-evolve | Knowledge schema co-evolution — scan + suggest updates |
| /mindlore-explore | Discover unexpected connections between sources |
| /mindlore-diary | Session analysis — decisions, discoveries, frictions |
| /mindlore-reflect | Pattern extraction from episodes, CLAUDE.md update proposals |
| /mindlore-maintain | KB maintenance — decay/archive, consolidation, contradiction |

## Testing

```bash
npm test                    # all suites
npx jest tests/fts5.test.ts  # specific suite
```

81 active suites in v0.6.2: fts5, fts5-sync, dedup, init, frontmatter, hook-smoke, uninstall, search-hook, session-focus, compounding, decision, read-guard, log, global-layer, cwd-changed, dont-repeat, post-read, upgrade, schemas, quality-populate, reflect, e2e-pipeline, evolve, explore, model-router, project-namespace, backup, obsidian, episodes, episodes-inject, diary, research-guard, research-guard-scope, skill-path-resolution, migrations-v053, cc-memory-bulk-sync, recall-telemetry, decay, git-snapshot, consolidation, backfill, session-payload, contradiction-extended, session-focus, daemon, daemon-integration, health-check-memory, cc-session-sync, pre-compact, migrations-v061, telemetry-perf, doctor, compaction-snapshot, migrations-v062, savings, session-summary, triage.

## Release

Versiyon yükseltme ve npm publish için `/mindlore-release` global skill'ini kullan. Normal `/release` skill'i DEĞİL.

## Planlama Referansları

Yeni versiyon planlarken bu dosyalara bakılmalı:

- **Sentez:** `~/.mindlore/analyses/2026-04-08-second-brain-architecture-decision.md` — 30+ karar, implementasyon durumu tablosu (YAPILDI/BEKLİYOR), versiyon roadmap
- **Plan v0.1:** `~/.claude/plans/elegant-juggling-balloon.md` — v0.0.1 implementasyon detayları, düzeltilen buglar
- **Plan v0.2:** `~/.claude/plans/mindlore-v020.md` — 9 faz, 29 dosya, compounding + karar takibi + session memory
- **MEMORY:** `~/.claude/projects/C--Users-Omrfc-Documents-kastell/memory/MEMORY.md` — Mindlore bölümü, sonraki session yönlendirmesi
