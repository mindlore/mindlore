# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.2] - 2026-04-14

### Added
- **Backup GitHub command:** `npx mindlore backup github` — creates private repo, sets remote, pushes in one step
- **Auto Obsidian sync:** Session-end hook exports .md files to Obsidian vault (wikilink conversion, mtime skip)
- **Auto FTS5 index on init:** Template files indexed immediately after init — no more orphan files
- **Init backup guide:** Updated to show `npx mindlore backup github` command

### Changed
- Backup gitignore: DB now backed up (was ignored), WAL + system + cache still ignored
- `commitIfDirty` and `pushIfRemote` helpers extracted in backup script (DRY)
- `ensureGhAuth` guard-exit pattern replaces nested try/catch in backup
- `exportMdFile` helper extracted in session-end hook (DRY)
- Session-end Obsidian sync uses `obsidian-helpers.convertToWikilinks` via compiled dist
- `mergeHooks` accepts optional plugin parameter — eliminates double plugin.json read in init
- `child_process` consolidated to single top-level import in init.ts
- Step numbering fixed in init.ts (was two Step 11s)
- `SYSTEM_FILES` constant shared for gitignore content
- Backup test assertion strengthened (regex match vs substring)

### Fixed
- Non-null assertion warnings in episodes parser (`!` → `?? ''`)
- `_`-prefixed files now correctly skipped in Obsidian auto-export

## [0.4.1] - 2026-04-14

### Added
- **Nomination kind:** 8th episode kind for rule proposals from reflect analysis
- **Nomination statuses:** staged/reviewed/approved/rejected status lifecycle
- **Supersedes chain display:** Session-focus injects last 7 days of decision evolution with reason parsing
- **Multi-session episode inject:** Enriched episodes from last N days grouped by date with 500-token cap
- **3-tier confidence pipeline:** Reflect skill now assesses patterns at Note/Learning/Nomination tiers
- **Stale content health check:** Session-focus warns when 3+ files are 30+ days old (monitors fallback)
- **Explore/evolve --all scope:** Default scope changed to project + global combined

### Changed
- Skill descriptions enriched (1536 char cap) in plugin.json — all 7 skills with detailed mode/feature info
- plugin.json version synced to 0.4.0
- templates/config.json: added `session_focus.multi_session_days` key (default: 3)
- CO-EVOLUTION: EPISODE_KINDS_CJS and EPISODE_STATUSES_CJS constants added to CJS mirror
- 33 suites, 241 tests total

### Fixed
- **Security:** Command injection via MINDLORE_HOME — execSync replaced with spawnSync argv
- **Security:** Missing transaction in FTS5 index update — wrapped in db.transaction()
- **Security:** Weak path containment — path.resolve + sep check replaces substring includes
- **Security:** Prototype pollution in parseFrontmatter — Object.create(null) + key blocklist
- **Security:** FTS5 MATCH keyword sanitization — control characters stripped
- **Efficiency:** readConfig called twice in session-focus — hoisted to single call
- **Efficiency:** Inline directory walk replaced with existing getAllMdFiles utility
- **Efficiency:** SQL datetime() string concatenation replaced with preformed modifier parameter

## [0.4.0] - 2026-04-13

### Added
- **Episodes table:** SQLite-based episodic memory — session/decision/event/preference/learning/friction/discovery kinds
- **Session-end bare episode:** Hook automatically captures commits, changed files, read stats as a session episode
- **Session-focus episode inject:** Last 3 episodes injected at session start (configurable via `config.json → session_focus.max_episodes`)
- **Diary mode** (`/mindlore-log diary`): LLM-driven session analysis with dedup rule and parent_id linkage
- **Reflect mode** (`/mindlore-log reflect`): Structured report format with episodes-powered pattern extraction
- **Episodes CLI:** `npx mindlore episodes list|search|show|count` with kind/project/limit filters
- **FTS5 episode mirror:** Episodes mirrored to FTS5 for unified search (knowledge + episodes)
- **Search hook episodes:** `mindlore-search` hook queries episode mirrors alongside FTS5 knowledge
- **Token display:** `post-read` hook now shows estimated token count via additionalContext on every file read
- **Read-guard enforcement:** 3+ repeated reads of the same file blocked with exit 2

### Changed
- `mindlore-log` skill: added diary mode, reflect upgraded to episodes-powered with structured output
- `mindlore-query` skill: search mode merges knowledge + episode results
- Session-end hook: single `getRecentGitInfo()` call replaces two sequential git spawns
- Session-end hook: episode + FTS5 writes wrapped in transaction for atomicity
- 31 suites, 221 tests total

## [0.3.5] - 2026-04-13

### Changed
- **Type safety enforcement:** Eliminated all unsafe `as Type` assertions across 37 files (scripts + tests)
- New helpers: `db-helpers.ts` (dbGet/dbAll/dbPragma), `safe-parse.ts` (parseJsonObject/readJsonFile), `tests/helpers/exec.ts` (getExecStdout/getExecResult)
- Added `mindlore-common.d.cts` type declarations for CJS module
- ESLint `no-unsafe-type-assertion: error` rule enforced
- Fixed N+1 `db.prepare()` in hot loops (fts5-index, quality-populate)
- Reconciled duplicate `MindloreConfig` interface, fixed nullable `FtsEntry` fields
- 28 suites, 172 tests total

## [0.3.4] - 2026-04-13

### Added
- **Backup CLI:** `mindlore backup init|status|remote|now` — git-based backup for `~/.mindlore/` with `.gitignore` template
- **Obsidian integration:** `mindlore obsidian export|import|status` — vault export with wikilink conversion, import with frontmatter injection
- **Reflect automation:** session-focus hook counts diary entries, injects warning at configurable threshold (default 5)
- **Project-namespaced cache:** `_session-reads-{project}.json` and `_pattern-cache-{project}.json` prevent cross-project collision

### Fixed
- Command injection in `backup remote` — replaced `execSync` string interpolation with `execFileSync` array args
- Git stderr leak in `backup status` — suppressed with explicit `stdio: 'pipe'`
- Session-focus hot path — single `readdirSync` instead of duplicate call
- Dead code removal in `obsidian-helpers` (unreachable `.db` check)
- TOCTOU fix in `shouldExport` — single try/catch instead of `existsSync` + `statSync`
- Redundant null guards in `obsidianStatus` after early return

### Changed
- 28 suites, 172 tests total
- `config.json` template: added `reflect.threshold` field

## [0.3.3] - 2026-04-12

### Changed
- **Global-first architecture:** single `~/.mindlore/` directory for all projects — per-project `.mindlore/` removed
- **FTS5 11th column:** `project UNINDEXED` — namespace per `path.basename(cwd)` at index time
- **`getProjectName()` helper:** shared in `mindlore-common.cjs` and `scripts/lib/constants.ts`
- **`MINDLORE_HOME` env var:** overrides global directory path (custom installs + test isolation)
- **Schema migration:** `detectSchemaVersion()` cascade extended with version 11; DROP+CREATE+reindex for FTS5 ALTER limitation
- **`init.ts`:** migrates existing project `.mindlore/` → `.mindlore.bak/`; removes `addToGitignore()` (global dir outside project)
- **`uninstall.ts`:** global-only cleanup; `--global` flag removed (always global now)
- **Search fallback:** project-scoped search falls back to all projects when no results found
- **SCHEMA.md template:** updated Global Scope section and FTS5 column table for v0.3.3
- 26 suites, 148 tests total

## [0.3.2] - 2026-04-12

### Added
- **CLI subcommands:** `npx mindlore health|search|index|quality` — no longer skill-only
- **`detectSchemaVersion()` helper:** shared FTS5 schema detection in `mindlore-common.cjs`
- **fts5-sync test suite:** 3 tests for incremental indexing (new file, skip unchanged, re-index on change)
- **dateCaptured test coverage:** 2 new tests + all existing insertFts calls updated with 10th column

### Fixed
- **Health check 10-col detection:** was hardcoded "9-col", now correctly detects and reports 10-col FTS5 schema
- **Uninstall skill deletion:** was wildcard `mindlore-*` deleting user's custom skills, now only removes plugin.json-registered skills
- **Init hook message:** now shows "N new (M total)" instead of just the count of newly added hooks

### Changed
- **CLAUDE.md:** updated hook/skill counts, TS references, 25 suites, corrected health check "16-point"
- **Skill docs:** health, ingest, evolve skills updated from `.cjs` script paths to `npm run` commands
- **plugin.json:** health description corrected 18→16 point
- 25 suites, 138 tests total

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
