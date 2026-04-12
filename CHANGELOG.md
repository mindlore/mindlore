# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-04-12

### Added
- **Model routing hook:** `mindlore-model-router.cjs` (PreToolUse Agent) — detects `[mindlore:SKILL]` markers, overrides model via `updatedInput` (ingest→haiku, evolve/explore→sonnet)
- **`config.json` template:** model defaults with fallback chain (config → default key → hardcoded)
- **Quality bulk populate:** `scripts/quality-populate.ts` — assigns quality to sources with null frontmatter using source_type heuristic + URL pattern fallback
- **`npm run quality`** script for bulk quality assignment
- **`QUALITY_HEURISTICS` constant:** centralized source_type → quality mapping
- **`DEFAULT_MODELS` in common:** single source of truth for hook + scripts
- **`readConfig()` helper:** shared config.json reader in `mindlore-common.cjs`
- **Agent delegation pattern:** ingest, evolve, explore skills updated to spawn subagents with `[mindlore:SKILL]` markers for cost-optimized model routing
- **3 new test suites:** model-router (9 tests), init config (3 tests), quality-populate bulk (5 tests) — 24 suites, 133 tests total

### Changed
- `init.ts` step 8: creates `config.json` with model defaults (idempotent merge)
- `plugin.json`: 13th hook registered (model-router, PreToolUse Agent)
- `mindlore-evolve` + `mindlore-explore` skills: Agent added to allowed-tools

## [0.3.0] - 2026-04-12

### Added
- **Global layer:** `~/.mindlore/` global scope with layered search (project first, global second)
- **3 new hooks:** `mindlore-cwd-changed` (scope detection), `mindlore-post-read` (token estimation), `mindlore-dont-repeat` (LESSONS rule enforcement with file-persisted cache)
- **2 new skills:** `mindlore-evolve` (knowledge schema co-evolution), `mindlore-explore` (undirected connection discovery)
- **FTS5 10th column:** `date_captured` (UNINDEXED) with 9→10 auto-migration
- **`insertFtsRow()` object API:** replaces 10 positional params across all indexing paths
- **Zod frontmatter validation:** 9 schemas (`scripts/lib/schemas.ts`) + `validateFrontmatter()`
- **Type safety:** `FTS5_COLUMNS`, `FRONTMATTER_TYPES`, `QUALITY_VALUES` const tuples, `hooks/lib/types.d.ts`
- **Version-aware init:** `.mindlore/.version` + `.pkg-version` written on init, session-focus warns on mismatch
- **`--global` / `--all` flags:** init, uninstall, fts5-search, all 7 skills scope-aware
- **Git auto-sync:** session-end hook auto-commits + pushes `~/.mindlore/` (graceful offline fail)
- **`hasMarkitdown()` / `hasYoutubeTranscript()`:** optional dependency detection helpers (memoized)
- **11 new test suites:** global-layer, cwd-changed, dont-repeat, post-read, upgrade, schemas, quality-populate, reflect, e2e-pipeline, evolve, explore (23 total, 116 tests)

### Changed
- All 5 existing skills updated with Scope section (`getActiveMindloreDir()` logic)
- `mindlore-search.cjs` refactored for layered search via `getAllDbs()`, N+1 DB fix
- `mindlore-log` reflect mode upgraded to LLM-driven pattern extraction (v0.3)
- `mindlore-ingest` skill: YouTube fallback chain, quality heuristic (always assign, never null)
- `mindlore-read-guard` updated: token display, number→object format upgrade
- `mindlore-session-end`: global git sync added
- `mindlore-session-focus`: version mismatch warning (flat file compare, no JSON parse)
- `extractFtsMetadata()` returns `dateCaptured` field
- Test helper `insertFts()` delegates to shared `insertFtsRow()`, uses `FtsEntry` interface
- Hook count: 9 → 12, Skill count: 5 → 7, FTS5 columns: 9 → 10
- `plugin.json`: 3 new hook entries + 2 new skill entries

### Fixed
- `mindlore-read-guard`: PreToolUse stdout → JSON `additionalContext` format (was plain text)
- `mindlore-fts5-sync`: removed unused stdout write (FileChanged swallows stdout)
- README: removed duplicate License + Node.js badges
- `mindlore-dont-repeat`: removed non-existent `FileWrite`/`FileEdit` tool names, skip `old_string` scanning

## [0.2.1] - 2026-04-11

### Changed
- Migrate scripts (6) and tests (12 suites + 1 helper) from CJS to TypeScript
- Hooks (10 files) remain `.cjs` — CC requires CJS hook scripts
- Add `tsconfig.json`, `ts-jest`, `typescript-eslint` build infrastructure
- `package.json` bin/scripts now point to `dist/` (compiled output)
- CI pipeline: added `typecheck` and `build` steps before lint/test
- Shared types (`Settings`, `HookEntry`, `isContentFile`) extracted to `constants.ts`
- `resolveHookCommon()` helper for dist/ vs src/ hook path resolution

### Fixed
- `read-guard` hook: `stderr` → `stdout` (CC only injects stdout as additionalContext)

## [0.2.0] - 2026-04-11

### Added
- FTS5 schema upgrade: 7 → 9 columns (+`tags` indexed, +`quality` UNINDEXED placeholder)
- `SQL_FTS_CREATE` shared constant (eliminates 5-place DDL drift risk)
- `readHookStdin()` shared utility (replaces 5 inline stdin parsers)
- `/mindlore-query` skill: 4 modes (search, ask, stats, brief) with full compounding pipeline
- `/mindlore-log` skill: 4 modes (log, reflect, status, save) for session memory
- `/mindlore-decide` skill: record + list decisions with supersedes chain
- `mindlore-decision-detector` hook: TR+EN decision signal detection (28 signals)
- `mindlore-read-guard` hook: OpenWolf repeated-read pattern (PreToolUse/Read)
- Structured session delta: commits, changed files, read stats (session-end v2)
- SCHEMA.md Section 6: Wiki vs Diary writeback target rules with anti-patterns
- SCHEMA.md: FTS5 9-column table documentation
- Health check +2: stale deltas (30+ days), conflicting analyses
- Ingest skill: 6-point post-ingest quality gate checklist
- Search hook: tags column injected in output
- Auto-migration: init detects 7-col → 9-col, upgrades in place
- 4 new test suites: decision, read-guard, log, compounding (was skipped)
- 16 new tests (39 → 55 total)

### Changed
- Health check: 16 → 18 checks
- Hooks: 7 → 9 (decision-detector, read-guard)
- Skills: 2 → 5 (query, log, decide)
- Test suites: 8 → 12
- plugin.json: updated with all v0.2 hooks and skills
- `health-check`: uses shared `parseFrontmatter` (was local duplicate)
- `health-check`: explicit ok/warn return (was ambiguous `ok: undefined`)
- `read-guard`: path-safe `.mindlore/` filter (was fragile string includes)

### Fixed
- `quality` field: null-safe check (`!== undefined && !== null` instead of `|| null`)

## [0.1.0] - 2026-04-11

### Added
- FTS5 schema upgrade: 2 columns → 7 (path, slug, description, type, category, title, content)
- Porter unicode61 tokenizer for stemming (running→run, çalışma→çalış)
- Rich search injection: `[Mindlore: category/title] description` format
- Per-keyword scoring with `MIN_KEYWORD_HITS=2` (false positive reduction)
- ~70 TR+EN stop words for noise filtering
- Auto-migration: `init.cjs` detects old 2-col schema, upgrades in place
- `SQL_FTS_INSERT` constant in shared module (eliminates 4-place drift risk)
- `extractHeadings()` + `parseFrontmatter()` shared in `mindlore-common.cjs`
- `extractFtsMetadata()` utility for frontmatter → FTS field mapping
- SCHEMA.md: `description`, `raw_slug`, `status` optional fields
- 3 new test suites: search-hook, session-focus, uninstall (8 total, 39 tests)
- `npx mindlore uninstall [--all]` command
- GitHub Actions: `release.yml` workflow (CHANGELOG extraction → GitHub Release)

### Fixed
- Hook stdout injection (CC ignores stderr for additionalContext)
- Stop word drift: centralized list, removed dead code
- `db.prepare()` hoisted outside loops for performance
- `fts5-sync.cjs`: skip redundant single `.md` re-index

### Changed
- `publish.yml`: GitHub Release creation moved to dedicated `release.yml`
- Health check INDEX limit: 30 → 60 entries
- Health check validates 7-column FTS5 schema
- README updated with 7-col search description

## [0.0.1] - 2026-04-10

### Added
- Initial project skeleton with 9-directory knowledge structure
- FTS5 full-text search via better-sqlite3 (content-hash dedup, BM25 ranking)
- `npx mindlore init` — idempotent setup (dirs, templates, DB, hook registration)
- 7 CC lifecycle hooks: session-focus, search, index, fts5-sync, session-end, pre-compact, post-compact
- 2 skills: `/mindlore-ingest`, `/mindlore-health`
- 5 scripts: init, uninstall, fts5-index, fts5-search, health-check (16-point structural audit)
- 5 test suites (23 tests): fts5, dedup, init, frontmatter, hook-smoke
- CI: GitHub Actions matrix (3 OS x 2 Node versions) with npm cache
- ESLint v9 flat config
- plugin.json for CC plugin manifest

### Fixed
- Hook registration format: use CC-standard `{ hooks: [{ type, command }] }` wrapper
- `init.cjs` HOME fallback: `os.homedir()` instead of `'~'` literal (Windows fix)
- `fts5-sync.cjs` guard logic: reject empty filePath instead of running full scan
- `fts5-search.cjs` frontmatter detection: regex instead of fragile indexOf
- `fts5-index.cjs` prepare-in-loop: move statement outside cleanup transaction

### Changed
- Extract shared modules: `hooks/lib/mindlore-common.cjs`, `scripts/lib/constants.cjs`, `tests/helpers/db.cjs`
- Remove dead code: unused extractSnippet, SNIPPET_LENGTH, execSync import
- Mark SCHEMA.md v0.2/v0.3 skills as PLANNED
- Clean unnecessary WHAT comments from tests
- Package placeholder on npm
