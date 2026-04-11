# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
