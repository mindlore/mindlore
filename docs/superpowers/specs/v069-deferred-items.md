# v0.6.9 Deferred Items

> Simplify review findings from v0.6.8 branch that were deferred for scope reasons.

## Performance

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | MEDIUM | `hooks/mindlore-fts5-sync.cjs:38` | Full `.md` scan + SHA256 on non-bulk triggers. Add guard to skip when trigger file is not `.md` |
| 2 | LOW | `hooks/mindlore-fts5-sync.cjs:65` | Per-file hash query — bulk fetch all hashes into Map before loop |
| 3 | NEEDS PROFILING | `hooks/mindlore-search.cjs` | ~500ms avg latency. Hypothesis: CPU-bound (FTS5+RRF+proximity+snippets). Needs actual profiling via `npm run perf` before optimization |

## Code Quality

| # | Severity | File | Issue |
|---|----------|------|-------|
| 4 | MEDIUM | 20+ call sites | Secure file I/O helper needed — `mode: 0o700` mkdir / `mode: 0o600` writeFile repeated inline |
| 5 | LOW | `scripts/cc-session-sync.ts` vs `cc-memory-bulk-sync.ts` | Transaction strategy inconsistency — per-item vs batch. Decide which pattern is canonical |
| 6 | LOW | 3 files | Repeated R4 pattern comment ("no file I/O inside DB transaction") — consolidate to single reference |

## Test Improvements

| # | Severity | File | Issue |
|---|----------|------|-------|
| 7 | LOW | `tests/migrations-v068.test.ts`, `tests/nomination-counts.test.ts` | Use `mkdtempSync`-based helpers instead of `Date.now()` pattern (race risk in parallel workers) |
| 8 | LOW | `tests/helpers/db.ts:61,78` | `createTestDbWithFullSchema` and `createTestDbWithMigrations` appear identical — alias or remove one |

## Monitoring

| # | Severity | Issue |
|---|----------|-------|
| 9 | LOW | busy_timeout reduced 5000→2000ms. Monitor for SQLITE_BUSY regressions under rapid session open/close |
