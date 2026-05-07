# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.1] - 2026-05-07

### Fixed
- Sync scripts (`cc-session-sync`, `cc-memory-bulk-sync`) now bundled alongside hooks for plugin cache compatibility — previously silently skipped because `dist/` was absent in plugin cache
- Bundled MCP server as `mcp-server.cjs` for plugin runtime
- Plugin hooks format updated to `hooks/hooks.json` with CC settings schema
- Removed `execSync` from hooks, replaced with `execFileSync` (command injection prevention)
- Externalized `secure-io.cjs` and `mindlore-common.cjs` in esbuild bundle (preserves octal permissions, prevents DB constructor inlining)
- Eslint config: bundled hooks (esbuild output) excluded from lint

### Added
- `.claude-plugin` marketplace manifest for CC plugin install
- Esbuild bundle pipeline for all 14 hooks (`hooks/src/` → `hooks/*.cjs`)
- Bundled-first script path resolution with `dist/` fallback

### Changed
- `bundle-hooks.ts`: shared `BASE_CONFIG`, parallel `Promise.all` build
- Script resolution simplified to single `.find()` with cached `nodeExe`

## [0.7.0] - 2026-05-05

### Added
- **MCP Server** — JSON-RPC stdio server exposing 6 tools to Claude Code (`mindlore_stats`, `mindlore_search`, `mindlore_recall`, `mindlore_brief`, `mindlore_decide`, `mindlore_ingest`)
- MCP tool adapters with input validation and telemetry (`scripts/lib/tool-adapters/`)
- Heading-aware smart snippet extraction for search results
- `errMsg` utility for consistent error message extraction across 9 files
- `slugify` utility extracted as shared module (`scripts/lib/slugify.ts`)
- MCP server lifecycle management (graceful shutdown, signal handling)
- CLI `mcp` subcommand entry point (`npx mindlore mcp`)
- `mcpServers` declaration in plugin.json for CC plugin integration
- MCP server stdio integration test suite

### Changed
- plugin.json upgraded with `mcpServers` field (plugin manifest v2)
- CLI help updated with `mcp` subcommand documentation

### Fixed
- Package.json path resolution for version display (was showing 0.0.0)
- Schema honesty: removed unimplemented `detail` and `url` fields from tool schemas
- `decide` tool schema: corrected union type for `action` field
- TOCTOU race condition fix in file operations
- Duplicate logic removed across tool adapters

## [0.6.9] - 2026-05-04

### Added
- `secure-io` helper: `safeReadFile`, `safeWriteFile`, `safeWriteJson` with path validation and atomic writes
- Manifest validation library (`scripts/lib/validate-manifest.ts`) with v2 schema support
- `validate-manifest-cli.ts` — CLI tool for plugin.json validation with error handling
- `plugin.json` upgraded to manifest v2 (version, minCCVersion, conflicts fields)
- `isKnownHookEvent()` guard function in constants.ts
- `KNOWN_HOOK_EVENTS` constant exported from constants.ts (single source of truth)
- Secure-io test suite (68 assertions)
- Manifest v2 test suite (10 assertions)

### Changed
- Hooks and scripts migrated to secure-io helper (replaces raw fs calls)
- Test tmpdir consolidated to `mkdtempSync` for parallel safety
- Test DB setup consolidated to shared `createTestDbWithMigrations` helper
- `validateSemVer` signature simplified: `(value, label, errors)` instead of stringly-typed field access
- fts5-sync: early-return guard + bulk hash fetch for performance
- fts5-sync: per-item transaction pattern (D5 fix) for reduced lock hold time

### Fixed
- Lint: unsafe type assertion in validate-manifest-cli replaced with type guard + spread

## [0.6.8] - 2026-05-03

### Added
- Migration v18: `idx_inject_log_injected_at` index for TTL cleanup performance
- Migration v19: Drop dead `documents_vec` shadow tables (embedding stack cleanup)
- `DB_BUSY_TIMEOUT_MS` shared constant in `hooks/lib/constants.cjs` and `scripts/lib/constants.ts`
- Jest `globalSetup.ts` with `needsBuild()` optimization (skip build if dist/ fresh)
- `createTestDbWithFullSchema` and `createTestDbAtVersion` test helpers
- `insertEpisode` and `insertInjectLog` test data helpers
- Conditional aggregation test for nomination counts
- Episode kind constant sync test (CJS/TS parity)
- DB busy_timeout sync test
- R4 regression test: file I/O outside DB transactions

### Changed
- Embedding stack fully removed: 4 source files, ~946MB dependency (`@huggingface/transformers`), 5 test files
- `busy_timeout` reduced from 5000ms to 2000ms (file I/O no longer inside transactions)
- `pretest` script removed — `globalSetup` is single source of build enforcement
- Nomination count queries merged into single conditional aggregation
- Episode kind array shared via `hooks/lib/constants.cjs` (CJS/TS sync guaranteed by test)
- Test DB setup centralized with full schema and versioned helpers
- Session-focus hook: removed redundant `statSync` calls
- Removed dead `loadSqliteVec`/`loadSqliteVecCjs` functions
- Removed context-mode tool references from `mindlore-query` skill

### Fixed
- DB lock root cause: file I/O inside transactions caused SQLITE_BUSY — moved outside in 3 hooks
- Double build eliminated (pretest + globalSetup was running build twice)

## [0.6.7] - 2026-05-03

### Added
- Lesson graduation pipeline: auto reflect trigger (Q1), graduation writes (Q2), graduated lesson count inject (Q3)
- Episode inject log TTL cleanup at session end (R4) — deletes entries older than 30 days
- Migration v15: `graduated_at`, `rejected_at`, `rejection_reason` columns on episodes table
- Migration v16: `episode_inject_log.episode_id` TEXT → INTEGER fix with data conversion
- Migration v17: TTL cleanup function (`cleanupExpiredInjectLog`)
- Integration tests for Q1/Q3 hook inject and R4 session-end cleanup
- Migration test suite for v0.6.7 (v15-v17 schema changes)
- Roadmap spec file (`docs/superpowers/specs/mindlore-roadmap.md`)

### Changed
- `loadDbContent` refactored from 7 positional params → options object
- `buildSessionPayload` refactored from 6 params → options bag
- `cleanupExpiredInjectLog` moved to `hooks/lib/mindlore-common.cjs` (shared between migration and session-end hook)
- Session-focus test cleanup: async retry → `fs.rmSync({ maxRetries })`, typed return

### Fixed
- Removed `CAST(rowid AS TEXT)` — `episode_inject_log.episode_id` is now INTEGER natively
- Added `V067_MIGRATIONS` to test helper for correct schema version expectations

## [0.6.6] - 2026-05-02

### Added
- `/mindlore-stats` skill for context visibility (token usage, hook latency, KB size)
- 5 source-type extraction templates (article, changelog, default, docs, github-repo)
- Ingest skill reads extraction template for source-type-aware analysis
- Init copies extraction templates to `.mindlore/`, preserves user customizations
- Search returns content snippets instead of metadata-only results
- Episode stale filter (7-day) + inject dedup via `episode_inject_log` table
- Centralized `ALL_MIGRATIONS` registry (`scripts/lib/all-migrations.ts`)

### Fixed
- WAL + `busy_timeout` added to upgrade path in init.ts (prevents DB locked errors)
- Schema version warning on mismatch (expected vs actual)
- Session payload `sessionId` passthrough for episode dedup
- Changed files list truncation (>10 → top 10 + count) to reduce context noise
- Misleading eslint-disable comment in `countMindloreHooks`

### Changed
- Extracted `countMindloreHooks` from init `mergeHooks` for reuse
- Extracted `getEpisodeStats` + `checkStaleContent` from session-focus
- Extracted `truncateSection` helper + anti-join SQL + transaction wrap
- Deduplicated SQL query + derived `FTS_DB_MIGRATIONS` from `ALL_MIGRATIONS`
- Removed redundant project computation + WHAT comment

## [0.6.5] - 2026-05-02

### Added
- Input-validation module — `sanitizeForExecFile`, `validatePath`, `validateUrl` (SEC-11)
- SEC regression test suite — 23 tests covering SEC-4/6/8/9/12/13
- fetch-raw security tests — path traversal + SSRF guard coverage
- `isInsideMindloreDir` + `extractMindloreBaseDir` shared helpers in mindlore-common
- IP range tests + IPv6 bracket parsing coverage
- STOP_WORDS fallback path test coverage

### Fixed
- **SEC-1**: Command injection — `execSync` → `execFileSync` in fetch-raw
- **SEC-2**: Path traversal + SSRF guards in fetch-raw
- **SEC-3**: Vault path traversal — home directory check in obsidian export
- **SEC-4**: Restrictive file permissions (0o600/0o700) for sensitive data
- **SEC-5**: Expanded secret redaction patterns in privacy-filter
- **SEC-6**: `execSync` → `execFileSync` across hooks and scripts (init, pre-compact, session-end)
- **SEC-7**: YAML frontmatter escaping via `escapeYamlValue`
- **SEC-8**: Daemon TCP connection limits (maxConnections, timeout, buffer cap)
- **SEC-9**: TOCTOU race in `isDaemonRunning` — removed existsSync pre-check
- **SEC-10**: SSRF private IP validation + IPv6 bracket fix
- **SEC-12**: Atomic write in `_rotateFile` — no leftover .tmp files
- **SEC-13**: baseDir resolution — `.mindlore-backup` partial match prevention
- Duplicate `resolvedFile` declaration in index hook

### Changed
- Shared `_searchFts` helper extracted (DRY)
- `extractKeywords` accepts `maxKeywords` parameter
- `cleanup()` throttled to once per 60s
- Removed hybrid-search dead code (unused since v0.6.3 search engine rewrite)
- Delta commit list truncated when >5 entries
- Updated zod and typescript-eslint dependencies

## [0.6.4] - 2026-05-01

### Added
- Cache hit rate telemetry — DB-persisted hits/misses with `getStats()`/`resetStats()`
- `Category` type union in constants.ts — compile-time typo guard for category weights
- `TURKISH_WORD_RE` shared constant — deduplicated regex across search-engine and fuzzy
- `SearchQueryOptions` interface — options object API for searchPorter/searchTrigram
- `SearchThrottle` class — extracted from SearchCache for single responsibility
- RRF micro-benchmark script (`mindlore-rrf-bench.ts`)
- STOP_WORDS fallback warning when `dist/` not built

### Fixed
- FTS5 search crash on hyphenated queries — sanitize `-` in `sanitizeFtsQuery`
- Silent `searchTrigram` catch — now logs warning on unexpected errors, suppresses expected "no such table"
- 23 lint warnings/errors resolved (no-non-null-assertion + no-unsafe-type-assertion)
- Cache stats prepare statements cached on instance (simplify review)
- IntentConfig.boosts typed as `Partial<Record<Category, number>>` (simplify review)

### Changed
- STOP_WORDS unified — single source in constants.ts, min length 2 (was divergent between search-engine.ts and mindlore-common.cjs)
- Intent config consolidated — `INTENT_CONFIG` single object replaces 3 separate constants
- INTENT_KEYS derived from INTENT_CONFIG via Object.keys (DRY)
- Lazy-init stats table in SearchCache — avoid CREATE TABLE on every get()

## [0.6.3] - 2026-05-01

### Added
- Search engine pipeline with RRF (Reciprocal Rank Fusion) — porter + trigram dual FTS5 tables
- Heading-based chunker with oversized handling + breadcrumb context
- Chunk-aware FTS5 indexing + `chunks` table migration
- Vocabulary table + fuzzy correction with Levenshtein distance
- Proximity reranking for multi-term queries
- Smart snippet extraction around query terms
- Intent-driven category boost (query intent → category weight)
- TTL cache + progressive throttling for search results
- FTS5 segment optimize after full re-index
- Mtime gate for atomic re-index (skip unchanged files)
- Slug collision guard + ETag cache for fetch-raw
- Integration tests for search pipeline + decision keywords export

### Fixed
- Simplify review — 11 fixes (2 critical bugs, 4 hot-path perf, 5 code quality)
- Vocabulary table guard in fts5-index
- Lint errors across migration tests, daemon integration, CLI

### Changed
- Search hook + CLI converted to thin wrappers over search-engine module
- Deprecated `hybrid-search.ts`, replaced by `search-engine.ts` + `rrf.ts`
- DRY refactors: corruption recovery, snapshot readdir, unpromoted raw check, pre-compact helpers → common
- Eliminated double diary scan in session-focus
- Merged 3 episode queries into 1 in session-payload
- Removed dead `lastHash` cache from session-payload
- Extracted `mergeDefaults` utility for init config merge
- Wired `withTimeoutDb` in search hook
- Moved raw accumulation check to worker
- 92 suites, 654 tests (up from 81 suites, 585 tests in v0.6.2)
- Benchmark: P95 search latency 265ms (target <300ms)

## [0.6.2] - 2026-04-28

### Added
- Compaction snapshot — preserve context across `/compact` with auto-resume injection (#17)
- Raw inbox triage — `listUnpromoted`, `extractRawMetadata`, birikme uyarısı (#15)
- Session summary injection — mekanik intent/karar extraction from transcripts (#9)
- Knowledge health dashboard — `getHealthDashboard()` stale/orphan/low-quality/recent (#26)
- URL cache with 24h TTL + content hash dedup for `fetch-raw` (#25)
- Context savings metric — `inject_tokens` + `source_tokens` in telemetry (#1)
- Upgrade subcommand routing — `npx mindlore upgrade` (#8)
- `detectOpenHandles` in Jest config (#4)
- `npm run audit` script for dependency security (#5)
- V0.6.2 migrations — `raw_metadata` table (v8) + `episodes.session_summary` column (v9)

### Fixed
- Code review + simplify findings — telemetry allowlist, token budget, git timeout, orphan counting, double file call (7 fixes)
- Fresh DB migration — V062 migrations now applied on `init` for new installs
- Session label collision — renamed to 'Past Sessions' to avoid FTS conflict
- `episode-kind` whitelist — `session-summary` added to EPISODE_KINDS
- Post-compact duplicate `diaryDir` declaration removed
- Obsidian recursive walk for deep directory sync (`raw/sessions/project/`)

### Changed
- **Session-focus perf: 2262ms → 52ms** — lazy integrity check, 98% improvement (#31B)
- Session-focus profiling markers for bottleneck identification (#31A)
- Perf report: pre-group by hook name — O(H*N) → O(N) filter
- Session-focus nesting refactor — `tryOpenDb` + `loadDbContent` extracted
- Doctor derives `EXPECTED_HOOKS` from plugin.json (no more hardcoded list)
- `_writeTelemetry` positional → object param refactor
- `withTimeoutDb` wired to DB queries + get mode
- `mergeDefaults` utility extracted for config merge
- `registerAgents` mtime+size guard (skip if unchanged)
- 81 suites, 585 tests (up from 76 suites, 558 tests in v0.6.1)

### Dependencies
- `@typescript-eslint/eslint-plugin` 8.58.2 → 8.59.0
- `@typescript-eslint/parser` 8.58.2 → 8.59.0
- `actions/cache` 4 → 5

## [0.6.1] - 2026-04-27

### Added
- **FTS table split:** Knowledge (`mindlore_fts`) ve session (`mindlore_fts_sessions`) tabloları ayrıldı. IDF kalitesi artırıldı (#11).
- **Category boost:** sources/domains/analyses daha yüksek, cc-session/cc-subagent daha düşük ağırlık.
- **Project-scoped search:** FTS5 fallback artık proje bazlı arama yapıyor, sonuç yoksa global fallback.
- **Version tokenization fix:** `0.6.1` gibi version numaraları FTS5 phrase match olarak aranıyor.
- **Recall shield:** `recall_count >= 3` olan dokümanlar decay'den muaf (#16).
- **Corrupt DB auto-recovery:** Session start'ta integrity check, corrupt DB yedeklenip silinir (#2).
- **`withTimeoutDb` wrapper:** Hook DB sorgularında busy_timeout güvenliği (#29).
- **`mindlore perf` CLI:** Hook latency raporu (p50/p95/p99), `--top N` ve `--savings` flagleri (#1).
- **`mindlore doctor` CLI:** 7 noktalı runtime doğrulama — Node, DB, config, FTS tabloları, hooks, skills, agents (#28).
- **Init agent registration:** `agents/` dizini otomatik `~/.claude/agents/` altına kopyalanıyor (#8).
- **Init `--upgrade` flag:** Mevcut kurulumda sadece hooks/skills/config günceller, dizin oluşturmayı atlar.
- **Init auto-doctor:** Kurulum sonunda otomatik doctor çalıştırılıyor.
- **DB migration v6:** Dirty project/category değerleri normalize edildi (#24).
- **DB migration v7:** FTS tablo split + `file_hashes.table_target` kolonu.
- **`--sessions` flag:** CLI search'te `mindlore_fts_sessions` tablosunu sorgulamak için.
- **Telemetry savings metric:** `_writeTelemetry` artık `injected_tokens`/`full_read_tokens` kabul ediyor (producer'lar v0.6.2'de).

### Fixed
- **Search output bug:** `r.meta` dead access — category, title, tags artık search inject'te doğru gösteriliyor.
- **Doctor SQL precedence:** FTS table check'te OR clause parantezlenmemişti, yanlış match olabiliyordu.
- **Doctor path resolution:** Skills/agents dizin çözümlemesi ve hook detection düzeltildi.
- **Shared constants dedup:** `SESSION_CATEGORIES`, `isSessionCategory`, `fixVersionTokens`, `SQL_FTS_SESSIONS_*` ortak modüle taşındı (4 dosyadaki duplikasyon kaldırıldı).
- **FTS sync hot-path:** Per-event `CREATE TABLE IF NOT EXISTS` kaldırıldı, migration'a güveniliyor.

### Changed
- Git push timeout 15s → 30s (#10).
- FTS index routing: cc-subagent/cc-session dokümanları `mindlore_fts_sessions` tablosuna yönlendiriliyor.
- FTS sync hook: Aynı tablo routing mantığı (knowledge vs sessions).

### Deprecated
- **Daemon** (`mindlore-daemon`): v0.7'de MCP Server ile değiştirilecek. Yeni özellik eklenmeyecek (#27).
- Session-focus hook'tan daemon auto-start kaldırıldı.

## [0.6.0] - 2026-04-25

### Breaking
- `@xenova/transformers@2` → `@huggingface/transformers@4.2.0`. Model ID ve embedding boyutu (e5-small, 384) aynı; mevcut FTS5/vec dataları geçerli.

### Changed
- `better-sqlite3` v11.10 → v12.9 (Node 24 prebuild desteği).
- CI matrix Node 24 eklendi (3 OS × 3 Node = 9 kombinasyon).

### Added
- `withTelemetry` / `withTelemetrySync` helper — 14 hook sarmalandı, `.mindlore/telemetry.jsonl` append-only log.
- `npm run cleanup` — raw/ frontmatter project backfill + FTS5 gap raporu.
- `tests/sqlite-vec-v12.test.ts` — vec0 v12 uyum smoke test.

### Fixed
- (Bulgu 5) `QUALITY_HEURISTICS` artık `cc-session`/`cc-subagent` source_type'larını tanıyor.
- (Bulgu 11) `loadObsidianHelpers` → `getObsidianHelpers` top-level cache + `MINDLORE_DEBUG=1` warn.

## [0.5.9] — 2026-04-24

### Added
- **`resolveProject` function** — frontmatter-first project resolution with 3-tier fallback (frontmatter → path-based → CWD)
- **Ingest `project` frontmatter field** — CWD-based project name automatically added to ingested raw files
- **Multi-URL batch ingest** — `/mindlore-ingest` now accepts space/comma-separated URLs with fail-forward processing
- **Agent model keys** in `config.json` — `assistant`, `researcher`, `librarian` routing keys
- **SCHEMA.md sections** — Database Tables (4 tables), Agents (3 agents), Session Storage

### Fixed
- **FTS5 project column inconsistency** — 3 indexing paths (fts5-index.ts, fts5-sync.cjs, mindlore-index.cjs) now use `resolveProject` instead of CWD-based detection
- **48 dirty FTS5 records cleaned** — removed `.mindlore`, `C--Users-*` project name variants
- **`agents/` missing from npm files** — `package.json` files array now includes `agents/`
- **Ingest SKILL.md wrong scope** — removed non-existent "project-local scope" description
- **Tracked `docs/prototypes/`** — removed from git (already in `.gitignore`)

### Changed
- **SCHEMA.md full update** v0.3.3 → v0.5.9 — all skills marked IMPLEMENTED, "Seven Operations" → "Ten Operations"
- **CLAUDE.md** test suite version updated to v0.5.9

## [0.5.8] — 2026-04-22

### Added
- **Pre-compact episode recording** — `mindlore-pre-compact.cjs` writes episode snapshot to `episodes/` before context compaction to prevent context loss
- **Connections section** in INDEX.md template
- **Context fork** for 5 long-running skills (explore, evolve, diary, reflect, maintain)

### Fixed
- **TOCTOU race condition** — search hook `existsSync`+`readFileSync` replaced with `try/catch`
- **Decay config not wired** — maintain skill now reads `halfLifeDays`/`staleThreshold` from `config.json`
- Simplify: reuse `getExecStdout` helper, hoist `Date`/ISO, DRY loops in pre-compact test
- Simplify: remove dead diary dir setup, update docstring in pre-compact
- ESLint unsafe-type-assertion resolved in pre-compact test

### Changed
- **Regex pre-screen** — `redactSecrets` in privacy-filter uses `includes()` prefix check before running regex patterns (performance)
- Bump actions/setup-node from 4 to 6
- Bump jest from 29.7.0 to 30.3.0
- Bump typescript from 6.0.2 to 6.0.3
- Bump eslint from 10.2.0 to 10.2.1

## [0.5.7] — 2026-04-22

### Added
- **CC Session Transcript Sync** — `cc-session-sync.ts` indexes CC JSONL session transcripts to FTS5 with automatic project slug, date extraction, and subagent detection
- `CC_SESSION_CATEGORY` and `CC_SUBAGENT_CATEGORY` constants in `constants.ts`
- Shared `sync-helpers.ts` module — `CommonModuleBase`, `CommonModuleWithFrontmatter`, `UPSERT_HASH_SQL`, `getArg`
- `npm root -g` fallback in all 9 skill Script Resolution blocks for non-standard install paths
- 1 new test suite: `cc-session-sync.test.ts` (18 tests)
- `source_type` assertions in `cc-memory-bulk-sync.test.ts`

### Fixed
- **`source_type` not written** — `cc-session-sync` and `cc-memory-bulk-sync` INSERT now correctly sets `source_type` in `file_hashes`
- **Nested UUID discovery** — session sync handles subagent paths under nested UUID directories
- **Array content extraction** — flat session JSONLs with array-format user content now parsed correctly
- Simplify: non-null assertions replaced with if-guards in session sync
- Simplify: `runSyncScript` helper extracted, sync loop flattened, regex overlap merged
- Simplify: duplicate upsert SQL, CommonModule interface, and CLI boilerplate extracted to `sync-helpers.ts`
- Test helper `createTestDb` expanded to full `file_hashes` schema (10 columns)

## [0.5.6] — 2026-04-20

### Added
- CC memory types (`feedback`, `user`, `project`, `reference`, `note`) to `FRONTMATTER_TYPES` and `TYPE_TO_DIR`
- 70 CC memory files now searchable in FTS5
- FTS5 sync gap recovery — re-indexes files when hash exists but FTS5 entry is missing
- New test suite: `health-check-memory.test.ts` (3 tests)
- Keyword overlap test for research guard
- FTS5 sync gap test

### Fixed
- **Research guard false positive** — now requires at least 2 keyword overlap in slug+title before blocking
- **FTS5 index sync gap** — `file_hashes` and `mindlore_fts` could get out of sync when external tools wrote hashes without FTS5 rows
- **Health check memory skip** — CC memory files (no frontmatter) no longer fail frontmatter validation
- **Health check type-dir tolerance** — CC memory types (`note`, `feedback`, etc.) allowed in `raw/` directory
- Simplify: `db.prepare()` hoisted outside transaction loop in FTS5 indexer
- Simplify: `ccMemoryTypes` Set replaced with `TYPE_TO_DIR` lookup (single source of truth)
- Simplify: keywords pre-lowercased once in research guard filter
- Daemon added to CLI help text

## [0.5.5] — 2026-04-20

### Added
- **Embedding daemon** — background TCP localhost server, loads model once (~16s), responds to embed requests in ~113ms
- `npx mindlore daemon start|stop|status` CLI subcommand
- `daemon-client.js` — plain JS execFileSync bridge for sync hook → async daemon communication
- Search hook now requests query-time embeddings from daemon → true hybrid search (FTS5 + vector + RRF)
- SessionStart auto-starts daemon as detached process
- Shared helpers in `mindlore-common.cjs`: `isDaemonRunning()`, `getDaemonPortFile()`, `getDaemonPidFile()`
- Tag collision resolution in `createPreEvictionTag` — appends `-2` through `-10` suffix
- `context: fork` added to health and query skills
- Tmp file cleanup in search hook (1h TTL, max 20 files)

### Changed
- Session-focus stale check: FS walk + statSync → SQL COUNT (reuses existing DB handle)
- `listStaleDocuments` bounded with `ORDER BY last_indexed ASC LIMIT 500`
- `DAEMON_PORT_FILE`/`DAEMON_PID_FILE` constants reuse `GLOBAL_MINDLORE_DIR`
- daemon.ts: TOCTOU fix (try/unlink instead of existsSync+unlink), 1MB buffer cap
- Git tag collision: CRLF-safe split (`/\r?\n/`)
- `mindlore-daemon.ts`: `forceCleanup()` helper eliminates duplicate stop logic
- Query skill frontmatter added (was missing)

### Fixed
- Session-focus test isolation — unique timestamp dir per test (Windows EPERM fix)
- `better-sqlite3` requirement downgraded to `^11.10.0` for broader compat

## [0.5.4] — 2026-04-19

### Added
- **Session-payload builder** — 4-section structured injection (Session, Decisions, Friction, Learnings) with 2000-token budget + content-hash cache-lock
- **Contradiction detection module** — extracted to `scripts/lib/contradiction.ts` with 4 rules: date conflict, boolean contradiction, version mismatch, frontmatter inconsistency
- **Backfill migration** — one-time script to populate 180 existing rows: created_at, importance, project_scope
- **Git snapshot** — `createPreEvictionTag()` + `listPreEvictionTags()` for pre-archive git tags
- **CC memory sync in SessionEnd** — detached worker runs `cc-memory-bulk-sync --auto` on session end
- **Embed trigger in SessionEnd** — detached `mindlore-fts5-index --embed` after session
- **Auto-backfill on upgrade** — `npx mindlore` detects version < 0.5.4 and runs backfill automatically
- **CLI subcommands** — added `memory-sync` and `fetch-raw`
- **Config: backup + reminders** — backup settings, diary/consolidation/evolve reminder thresholds
- **logs/ and memory/ directories** — created during init, hookLog writes to logs/

### Fixed
- **DB busy_timeout** — all `openDatabase` (CJS + TS) now set `busy_timeout=5000` for concurrent access
- **Search hook DB access** — replaced 3 raw `new Database()` calls with `openDatabase()` (WAL + busy_timeout)
- **Search fallback logging** — hybrid→FTS5 fallback now logged via hookLog instead of silent
- **Research-guard scope** — only blocks `researcher`/`Explore` agents, lets coder/code-reviewer/general-purpose pass
- **Code review M1-M5** — schema backward-compat test, tag exact-match, decay config wire-up, resolveTargetDir docs

### Changed
- **Session-focus hook** — replaced 7+ scattered injection sections with consolidated 4-section payload builder
- **FTS5 indexer** — now writes created_at, updated_at, project_scope, importance on every INSERT/UPDATE
- **Decay persistence** — `persistDecayScores()` writes decay_score + last_decay_calc back to episodes table
- **Importance mapping** — quality frontmatter (high/medium/low) mapped to importance (1.0/0.6/0.3)
- Config template version bumped to 0.5.4

## [0.5.3] — 2026-04-18

### Added
- **Recall telemetry** — tracks search hit frequency per document (recall_count, last_recalled_at)
- **Decay/eviction system** — time-based decay score with access boost, archive/restore helpers, pre-eviction git snapshots
- **Episode consolidation** — group raw episodes by kind, promote to learnings/insights/analyses/decisions
- **`/mindlore-maintain` skill** — KB maintenance: decay reports, consolidation, contradiction detection
- **CC memory bulk sync** — `npm run cc-sync` one-shot script for existing Claude Code memory files
- **Ingest source_type** — auto-detection from URL pattern (github-repo, docs, blog, video, etc.)
- **Evolve fresh KB filter** — skip scan when 0 domains or <3 sources
- **Reflect quick health summary** — SQL-based stale/raw episode counts after pattern extraction
- **Session-focus consolidation reminder** — shows when 50+ raw episodes accumulate

### Fixed
- **Skill script path resolution** — all 8 skills work from any project directory via MINDLORE_PKG preamble
- **Health check CC memory warning** — informative message instead of false warning on fresh installs

### Changed
- **Search hook now writes recall telemetry** — previously read-only, now increments recall_count on search hits (graceful fallback on read-only DB)
- Migration v4: recall_count, last_recalled_at, archived_at, importance on file_hashes
- Migration v5: consolidation_status, consolidated_into, decay_score, last_decay_calc on episodes
- Config template: added decay and consolidation settings

## [0.5.2] - 2026-04-18

### Added
- **3 agents:** mindlore-assistant (search+cite), mindlore-researcher (web research), mindlore-librarian (maintenance)
- **Skeleton-mode compression:** Structural skeleton extraction for repeated file reads (JS/TS/Python/Markdown)
- **Skill memory:** Persistent key-value store per skill via `skill_memory` SQLite table + CLI entrypoint
- **Wiki lint:** Contradiction detection across sources/domains (numeric claim conflicts)
- **FTS5 catch-up:** Automatic indexing of subagent-written files within 5-minute window
- **Search offload:** Results >10KB written to tmp/ with pointer injection
- **fetch-raw pipeline:** Zero-token URL fetching (GitHub API, curl, Jina) with frontmatter generation
- **Diary/Reflect skills:** Split from monolithic log skill into focused `/mindlore-diary` and `/mindlore-reflect`
- **CC_MEMORY_BOOST:** 1.2x query-time scoring boost for cc-memory category results
- **DB helpers:** `withReadonlyDb` and `openDatabaseTs` for safe database access patterns

### Fixed
- **Shell injection (CRITICAL):** `fetch-raw.ts` `execSync` → `execFileSync` with URL validation
- **Dead tiebreaker:** Search sort used undefined `totalRank` instead of `rank`
- **hookLog arity:** Search offload called `hookLog` with 1 arg instead of required 3
- **fetchGitHub scope:** Renamed to `fetchGitHubReadme` with repo-root-only regex to prevent silent wrong results
- **Duplicate stop word:** `'hem'` appeared twice in STOP_WORDS set
- **Duplicate package.json key:** `fetch-raw` script entry duplicated
- **Token budget comment:** Corrected ~500 → ~625 tokens annotation

### Changed
- **Skeleton single source of truth:** CJS hooks require compiled TS skeleton instead of maintaining ~100-line duplicate
- **SHARED_EXPORT_DIRS:** Derived from compiled constants.ts instead of hardcoded array
- **skill-memory.ts:** Private `openDb` replaced with `withReadonlyDb`/`openDatabaseTs` from db-helpers
- **health-check refactor:** 7x DB open boilerplate → `withCheckedDb` helper (-203 LOC)
- **dbAll/dbGet constraint:** `Record<string, unknown>` → `object` (removes need for index signatures)
- **CC_MEMORY constants:** Magic string `'cc-memory'` and `1.2` → exported `CC_MEMORY_CATEGORY`/`CC_MEMORY_BOOST`
- **resolveHookCommon:** Redundant 3-element candidates array removed, walk-up loop sufficient
- **Ingest skill:** Refactored to use context:fork + fetch-raw zero-token pipeline

## [0.5.1] - 2026-04-16

### Added
- **Privacy filter:** Regex-based secret redaction (OpenAI, AWS, GitHub, npm, Slack, connection strings) before DB writes
- **CC memory sync:** FileChanged hook detects `~/.claude/projects/*/memory/*.md`, applies privacy filter, indexes to FTS5 with `category='cc-memory'`, copies to `~/.mindlore/memory/{project}/`
- **Token budgeting:** Configurable token limits for session inject and search results to prevent context bloat
- **Duplicate detection:** FTS5-based similarity check on ingest with CLI entrypoint and skill integration
- **DB migrations v0.5.1:** New columns `source_type`, `project_scope`, `content_hash` on `file_hashes` table
- **Health checks:** 2 new checks — `source_type` column presence + CC memory sync status
- **Regression test:** Double `db.close()` crash prevention in `indexCcMemory`

### Fixed
- **Double db.close() bug:** Early return in `indexCcMemory` no longer crashes from double close (finally handles it)
- **Regex precision:** GitHub PAT and npm token patterns restored to `{36,}` minimum for fewer false positives
- **Search I/O halved:** Heading extraction moved after dedup/slice — reads 3 files instead of 6 per prompt

### Changed
- **FTS5 fallback optimized:** O(docs x keywords) nested loop replaced with single OR-joined MATCH query
- **SessionEnd worker async:** Obsidian sync + git-sync run in parallel via `Promise.allSettled`
- **Shared helpers:** `SHARED_EXPORT_DIRS` and `resolveWin32Bin` extracted to `mindlore-common.cjs`
- **Reuse improvements:** `similarity.ts` uses `extractKeywords`/`sanitizeKeyword` from common; search hook uses `sanitizeKeyword`; dead code (`CC_MEMORY_BOOST`) removed
- **Config upgrade:** `npx mindlore init` backfills `tokenBudget` from template for pre-v0.5.1 configs

## [0.5.0] - 2026-04-15

### Added
- **Hybrid search engine:** RRF (Reciprocal Rank Fusion) combining FTS5 keyword + sqlite-vec vector results
- **Embedding pipeline:** multilingual-e5-small model via @xenova/transformers for semantic vector generation
- **sqlite-vec integration:** Vector table management with 384-dimension embeddings
- **Synonym expansion:** Bilingual (TR/EN) synonym module for improved FTS5 recall
- **Schema version system:** Migration runner with versioned upgrades (v0.5.0 adds vec table + timestamp columns)
- **`--hybrid` flag:** Search script supports hybrid mode with automatic fallback
- **`--embed` flag:** Index script generates embeddings alongside FTS5 indexing
- **Vec table health checks:** Schema version and vec table integrity validation
- **Hybrid search in hook:** Search hook auto-uses hybrid mode with synonym expansion when available
- **Synonyms and hybrid config:** Template config includes synonym and hybrid search settings

### Fixed
- **sqlite-vec load order:** Extension loaded before migrations to prevent vec table creation failure
- **Graceful vec table creation:** Handles missing sqlite-vec extension without crashing
- **Lint errors:** Resolved all lint warnings from v0.5.0 integration

### Changed
- **Double normalization removed:** Simplified score normalization in search pipeline
- **Named constants:** Magic numbers replaced with descriptive constants
- **Cleaner health checks:** Streamlined health check output formatting
- Dependencies: added `sqlite-vec` and `@xenova/transformers`
- Test suites: 32 → 38, tests: 249 → 280

## [0.4.3] - 2026-04-14

### Added
- **Research guard hook:** `mindlore-research-guard.cjs` — FTS5 check before spawning researcher agents. Blocks (exit 2) if high-quality + recent knowledge exists, warns if old/low quality. Bypass with `[research-override]`
- **Shared FTS5 utilities:** `extractKeywords`, `sanitizeKeyword`, `STOP_WORDS` moved to `mindlore-common.cjs` — single source of truth for search + research-guard hooks
- **Research guard test suite:** 8 tests covering block, warn, bypass, exclude, and edge cases (32 active suites, 249 tests)

### Fixed
- **SessionEnd "Hook cancelled" fix:** Heavy ops (episode write, Obsidian sync, git push) now run in detached child process that survives CC exit ([#41577](https://github.com/anthropics/claude-code/issues/41577))
- **Worker data via temp file:** Avoids Windows argv 32K limit — worker reads JSON from temp file instead of command-line arg
- **Episode write error logging:** Outer catch now writes to stderr instead of silent swallow
- **FTS5 keyword sanitization:** Hyphens converted to spaces (`sqlite-vec` → `"sqlite vec"`) instead of being stripped (caused zero matches)
- **Quality case sensitivity:** `quality` field lowercased on read — prevents `'High'` vs `'high'` mismatch
- **Date field backfill:** 86 files received `date_captured` from mtime, 54 files received `quality` assignment

### Changed
- FTS5 search in research-guard uses single `MATCH OR` query instead of O(paths × keywords) loop
- Quality/date read from FTS5 columns directly — no file I/O in hot path
- `git add -A` in global sync replaced with explicit mindlore file patterns
- `title` field no longer double-truncated in episode FTS5 mirror
- Hook count: 13 → 14, test suites: 31 → 32, tests: 241 → 249
- Telegram plugin updated 0.0.4 → 0.0.5 (stale poller fix)

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
