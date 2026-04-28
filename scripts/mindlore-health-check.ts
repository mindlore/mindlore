#!/usr/bin/env node

/**
 * mindlore-health-check — 16-point structural health check for .mindlore/
 *
 * Usage: node dist/scripts/mindlore-health-check.js [path-to-mindlore-dir]
 *
 * Exit codes: 0 = healthy, 1 = issues found
 */

import fs from 'fs';
import path from 'path';
import { DIRECTORIES, TYPE_TO_DIR, DB_NAME, GLOBAL_MINDLORE_DIR, resolveHookCommon, isContentFile, CC_MEMORY_CATEGORY } from './lib/constants.js';
import { dbGet, dbAll, withReadonlyDb } from './lib/db-helpers.js';
import { detectContradictions } from './lib/contradiction.js';
import type BetterSqlite3 from 'better-sqlite3';

type Database = BetterSqlite3.Database;

interface MindloreCommon {
  detectSchemaVersion: (db: unknown) => number;
  parseFrontmatter: (content: string) => { meta: Record<string, string>; body: string };
  getAllMdFiles: (dir: string, skipFiles?: Set<string>) => string[];
}
const common: MindloreCommon = require(resolveHookCommon(__dirname));
const { detectSchemaVersion, parseFrontmatter: _parseFm, getAllMdFiles: _getAllMd } = common;

// ── Helpers ────────────────────────────────────────────────────────────

interface FrontmatterData {
  slug?: string;
  type?: string;
  tags?: string | string[];
  confidence?: string;
  archived?: string;
  [key: string]: unknown;
}

function parseFrontmatter(content: string): FrontmatterData | null {
  const { meta } = _parseFm(content);
  return Object.keys(meta).length > 0 ? meta : null;
}

function getAllMdFiles(dir: string): string[] {
  return _getAllMd(dir, new Set());
}

// ── Wiki lint ──────────────────────────────────────────────────────────

export function detectWikiContradictions(baseDir: string): string[] {
  const sourcesDir = path.join(baseDir, 'sources');
  const domainsDir = path.join(baseDir, 'domains');
  const warnings: string[] = [];

  const tagMap = new Map<string, Array<{ path: string; content: string }>>();

  for (const dir of [sourcesDir, domainsDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const tagMatch = content.match(/tags:\s*\[([^\]]+)\]/);
      if (!tagMatch) continue;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- tagMatch[1] exists when tagMatch is truthy (capture group 1)
      const tags = tagMatch[1]!.split(',').map((t) => t.trim().replace(/['"]/g, ''));
      for (const tag of tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- tagMap.has(tag) check above ensures entry exists
        tagMap.get(tag)!.push({ path: filePath, content });
      }
    }
  }

  for (const [tag, files] of tagMap) {
    if (files.length < 2) continue;
    const numericClaims = new Map<string, Array<{ file: string; value: string }>>();

    for (const { path: fp, content } of files) {
      const matches = content.matchAll(/(\w+)\s+(?:has|uses|contains|supports)\s+(\d+)\s+(\w+)/gi);
      for (const m of matches) {
        const key = `${m[1]?.toLowerCase()} ${m[3]?.toLowerCase()}`;
        if (!numericClaims.has(key)) numericClaims.set(key, []);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- numericClaims.has(key) check above ensures entry exists; m[2] is capture group 2 of a successful match
        numericClaims.get(key)!.push({ file: fp, value: m[2]! });
      }
    }

    for (const [claim, entries] of numericClaims) {
      const values = new Set(entries.map((e) => e.value));
      if (values.size > 1) {
        const fileNames = entries.map((e) => path.basename(e.file)).join(', ');
        warnings.push(`[${tag}] "${claim}" has conflicting values: ${[...values].join(' vs ')} in ${fileNames}`);
      }
    }
  }

  return warnings;
}

// ── Checks ─────────────────────────────────────────────────────────────

interface CheckResult {
  ok?: boolean;
  warn?: boolean;
  detail: string;
}

interface ReportEntry {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
}

class HealthChecker {
  private baseDir: string;
  private results: ReportEntry[] = [];
  private passed = 0;
  private failed = 0;
  private warnings = 0;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private withCheckedDb(fn: (db: Database) => CheckResult): CheckResult {
    const dbPath = path.join(this.baseDir, DB_NAME);
    if (!fs.existsSync(dbPath)) return { warn: true, detail: 'database missing' };
    const result = withReadonlyDb(dbPath, fn);
    return result ?? { ok: false, detail: 'database open failed' };
  }

  check(name: string, fn: () => CheckResult): void {
    try {
      const result = fn();
      if (result.ok) {
        this.passed++;
        this.results.push({ name, status: 'PASS', detail: result.detail });
      } else if (result.warn) {
        this.warnings++;
        this.results.push({ name, status: 'WARN', detail: result.detail });
      } else {
        this.failed++;
        this.results.push({ name, status: 'FAIL', detail: result.detail });
      }
    } catch (err) {
      this.failed++;
      const message = err instanceof Error ? err.message : String(err);
      this.results.push({ name, status: 'FAIL', detail: message });
    }
  }

  checkDirectories(): void {
    for (const dir of DIRECTORIES) {
      this.check(`Directory: ${dir}/`, () => {
        const dirPath = path.join(this.baseDir, dir);
        if (fs.existsSync(dirPath)) {
          return { ok: true, detail: 'exists' };
        }
        return { ok: false, detail: 'missing' };
      });
    }
  }

  checkSchema(): void {
    this.check('SCHEMA.md', () => {
      const schemaPath = path.join(this.baseDir, 'SCHEMA.md');
      if (!fs.existsSync(schemaPath)) {
        return { ok: false, detail: 'missing' };
      }
      const content = fs.readFileSync(schemaPath, 'utf8');
      if (content.length < 100) {
        return { ok: false, detail: 'too short (corrupted?)' };
      }
      if (!content.includes('## 1. Identity')) {
        return { warn: true, detail: 'may be outdated (missing Identity section)' };
      }
      return { ok: true, detail: `${content.split('\n').length} lines` };
    });
  }

  checkIndex(): void {
    this.check('INDEX.md format', () => {
      const indexPath = path.join(this.baseDir, 'INDEX.md');
      if (!fs.existsSync(indexPath)) {
        return { ok: false, detail: 'missing' };
      }
      const content = fs.readFileSync(indexPath, 'utf8');
      const lines = content.trim().split('\n');
      if (lines.length > 60) {
        return {
          warn: true,
          detail: `${lines.length} lines (should be ~15-60, consider trimming)`,
        };
      }
      return { ok: true, detail: `${lines.length} lines` };
    });
  }

  checkDatabase(): void {
    this.check('mindlore.db FTS5', () => this.withCheckedDb((db) => {
      const result = dbGet<{ cnt: number }>(db, 'SELECT count(*) as cnt FROM mindlore_fts') ?? { cnt: 0 };
      const hashResult = dbGet<{ cnt: number }>(db, 'SELECT count(*) as cnt FROM file_hashes') ?? { cnt: 0 };
      const schemaVersion = detectSchemaVersion(db);

      if (schemaVersion < 11) {
        return {
          warn: true,
          detail: `${result.cnt} indexed, ${hashResult.cnt} hashes — ${schemaVersion}-col schema (run: npx mindlore init to upgrade to 11-col)`,
        };
      }
      return { ok: true, detail: `${result.cnt} indexed, ${hashResult.cnt} hashes, 11-col schema` };
    }));

    this.check('documents_vec table', () => this.withCheckedDb((db) => {
      try {
        const sqliteVec: { load: (db: unknown) => void } = require('sqlite-vec');
        sqliteVec.load(db);
        const result = dbGet<{ cnt: number }>(db, 'SELECT count(*) as cnt FROM documents_vec') ?? { cnt: 0 };
        return { ok: true, detail: `${result.cnt} vectors indexed` };
      } catch (_err) {
        return { warn: true, detail: 'sqlite-vec not available or vec table not created (run: npm run index -- --embed)' };
      }
    }));

    this.check('schema version', () => this.withCheckedDb((db) => {
      try {
        const { getSchemaVersion } = require('./lib/schema-version.js');
        const version = getSchemaVersion(db);
        return { ok: true, detail: `v${version}` };
      } catch (_err) {
        return { warn: true, detail: 'schema_versions table missing' };
      }
    }));
  }

  checkOrphans(): void {
    this.check('Orphan files', () => {
      const mdFiles = getAllMdFiles(this.baseDir).filter(isContentFile);
      return this.withCheckedDb((db) => {
        const indexed = new Set<string>();
        const rows = dbAll<{ path: string }>(db, 'SELECT path FROM file_hashes');
        for (const row of rows) {
          indexed.add(path.resolve(row.path));
        }

        const orphans = mdFiles.filter((f) => !indexed.has(path.resolve(f)));

        if (orphans.length === 0) return { ok: true, detail: 'no orphans' };
        if (orphans.length <= 3) {
          return { warn: true, detail: `${orphans.length} unindexed: ${orphans.map((f) => path.basename(f)).join(', ')}` };
        }
        return { ok: false, detail: `${orphans.length} unindexed files — run: npm run index` };
      });
    });
  }

  checkFrontmatter(): void {
    this.check('Frontmatter: slug + type', () => {
      const mdFiles = getAllMdFiles(this.baseDir).filter(isContentFile);

      let missingSlug = 0;
      let missingType = 0;
      let wrongDir = 0;

      for (const file of mdFiles) {
        // CC memory files have no frontmatter — skip validation
        const relDir = path.basename(path.dirname(file));
        if (relDir === 'memory') continue;

        const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        const fm = parseFrontmatter(content);

        if (!fm) {
          missingSlug++;
          missingType++;
          continue;
        }

        if (!fm.slug) missingSlug++;
        if (!fm.type) {
          missingType++;
          continue;
        }

        const expectedDir = TYPE_TO_DIR[fm.type];
        if (expectedDir) {
          const parentDir = path.basename(path.dirname(file));
          if (parentDir !== expectedDir && !(TYPE_TO_DIR[fm.type] === 'memory' && parentDir === 'raw')) {
            wrongDir++;
          }
        }
      }

      const issues: string[] = [];
      if (missingSlug > 0) issues.push(`${missingSlug} missing slug`);
      if (missingType > 0) issues.push(`${missingType} missing type`);
      if (wrongDir > 0) issues.push(`${wrongDir} type-dir mismatch`);

      if (issues.length === 0) {
        return {
          ok: true,
          detail: `${mdFiles.length} files validated`,
        };
      }
      if (wrongDir > 0) {
        return { ok: false, detail: issues.join(', ') };
      }
      return { warn: true, detail: issues.join(', ') };
    });
  }

  checkStaleDeltas(): void {
    this.check('Stale deltas', () => {
      const diaryDir = path.join(this.baseDir, 'diary');
      if (!fs.existsSync(diaryDir)) return { ok: true, detail: 'no diary dir' };

      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      let stale = 0;

      const files = fs.readdirSync(diaryDir).filter((f) => f.startsWith('delta-') && f.endsWith('.md'));
      for (const file of files) {
        const fullPath = path.join(diaryDir, file);
        const content = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
        const fm = parseFrontmatter(content);
        if (fm && fm.archived === 'true') continue;

        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > thirtyDays) stale++;
      }

      if (stale === 0) return { ok: true, detail: `${files.length} deltas, none stale` };
      return { warn: true, detail: `${stale} deltas older than 30 days without archived flag — run /mindlore-log reflect` };
    });
  }

  checkConflictingAnalyses(): void {
    this.check('Conflicting analyses', () => {
      const analysesDir = path.join(this.baseDir, 'analyses');
      if (!fs.existsSync(analysesDir)) return { ok: true, detail: 'no analyses dir' };

      const files = fs.readdirSync(analysesDir).filter((f) => f.endsWith('.md'));
      if (files.length < 2) return { ok: true, detail: `${files.length} analyses, no conflict possible` };

      const tagMap: Record<string, Array<{ file: string; confidence: string }>> = {};
      for (const file of files) {
        const content = fs.readFileSync(path.join(analysesDir, file), 'utf8').replace(/\r\n/g, '\n');
        const fm = parseFrontmatter(content);
        if (!fm?.tags || !fm.confidence) continue;

        const tags = Array.isArray(fm.tags) ? fm.tags : String(fm.tags).split(',').map((t) => t.trim());
        for (const tag of tags) {
          if (!tagMap[tag]) tagMap[tag] = [];
          const entries = tagMap[tag];
          if (entries) entries.push({ file, confidence: String(fm.confidence) });
        }
      }

      const conflicts: string[] = [];
      for (const [tag, entries] of Object.entries(tagMap)) {
        if (!entries || entries.length < 2) continue;
        const confidences = new Set(entries.map((e) => e.confidence));
        if (confidences.size > 1) {
          conflicts.push(`${tag}: ${entries.map((e) => `${e.file}(${e.confidence})`).join(' vs ')}`);
        }
      }

      if (conflicts.length === 0) return { ok: true, detail: `${files.length} analyses, no conflicts` };
      return { warn: true, detail: `${conflicts.length} tag conflicts: ${conflicts.slice(0, 2).join('; ')}` };
    });
  }

  checkSourceTypeColumn(): void {
    this.check('source_type column', () => this.withCheckedDb((db) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pragma returns array
      const cols = db.pragma('table_info(file_hashes)') as Array<{ name: string }>;
      const has = cols.some(c => c.name === 'source_type');
      return has
        ? { ok: true, detail: 'source_type column present' }
        : { warn: true, detail: 'source_type column missing — run: npm run index' };
    }));
  }

  checkCcMemorySync(): void {
    this.check('CC memory sync', () => this.withCheckedDb((db) => {
      const row = dbGet<{ cnt: number }>(db, 'SELECT COUNT(*) as cnt FROM mindlore_fts WHERE category = ?', CC_MEMORY_CATEGORY);
      const count = row?.cnt ?? 0;
      return count > 0
        ? { ok: true, detail: `${count} CC memory entries synced` }
        : { ok: true, detail: 'No CC memory yet — normal for fresh installs, syncs automatically on file changes' };
    }));
  }

  checkWikiContradictions(): void {
    this.check('wiki-lint', () => {
      const warnings = detectWikiContradictions(this.baseDir);
      return warnings.length === 0
        ? { ok: true, detail: 'No contradictions detected' }
        : { warn: true, detail: `${warnings.length} potential contradiction(s):\n${warnings.join('\n')}` };
    });
  }

  checkSkillMemoryTable(): void {
    this.check('skill-memory-table', () => this.withCheckedDb((db) => {
      const table = dbGet<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='skill_memory'");
      return table
        ? { ok: true, detail: 'skill_memory table exists' }
        : { warn: true, detail: 'skill_memory table missing (run npm run index)' };
    }));
  }

  checkDecayStats(): void {
    this.check('decay stats', () => this.withCheckedDb((db) => {
      try {
        const row = dbGet<{ cnt: number }>(db,
          'SELECT COUNT(*) as cnt FROM file_hashes WHERE archived_at IS NOT NULL'
        );
        const archived = row?.cnt ?? 0;

        const staleRow = dbGet<{ cnt: number }>(db,
          "SELECT COUNT(*) as cnt FROM file_hashes WHERE recall_count = 0 AND archived_at IS NULL AND last_indexed < datetime('now', '-60 days')"
        );
        const staleCount = staleRow?.cnt ?? 0;

        if (staleCount > 10) {
          return { warn: true, detail: `${staleCount} stale documents (0 recalls, >60 days old). Run /mindlore-maintain decay` };
        }
        return { ok: true, detail: `${archived} archived, ${staleCount} potentially stale` };
      } catch (_err) {
        return { ok: true, detail: 'decay columns not yet available (run npm run index)' };
      }
    }));
  }

  checkContradictions(): void {
    this.check('content contradictions', () => {
      const contradictions = detectContradictions(this.baseDir);
      if (contradictions.length === 0) {
        return { ok: true, detail: 'No content contradictions detected' };
      }
      const summary = contradictions.slice(0, 3).map(c => `[${c.rule}] ${c.detail}`).join('; ');
      return { warn: true, detail: `${contradictions.length} contradiction(s): ${summary}` };
    });
  }

  checkConsolidation(): void {
    this.check('episode consolidation', () => this.withCheckedDb((db) => {
      try {
        const row = dbGet<{ cnt: number }>(db,
          "SELECT COUNT(*) as cnt FROM episodes WHERE consolidation_status = 'raw' OR consolidation_status IS NULL"
        );
        const raw = row?.cnt ?? 0;
        if (raw >= 50) {
          return { warn: true, detail: `${raw} raw episodes. Run /mindlore-maintain consolidate` };
        }
        return { ok: true, detail: `${raw} raw episodes` };
      } catch (_err) {
        return { ok: true, detail: 'consolidation columns not yet available' };
      }
    }));
  }

  run(): this {
    this.checkDirectories();
    this.checkSchema();
    this.checkIndex();
    this.checkDatabase();
    this.checkOrphans();
    this.checkFrontmatter();
    this.checkStaleDeltas();
    this.checkConflictingAnalyses();
    this.checkSourceTypeColumn();
    this.checkCcMemorySync();
    this.checkWikiContradictions();
    this.checkSkillMemoryTable();
    this.checkDecayStats();
    this.checkConsolidation();
    this.checkContradictions();
    return this;
  }

  report(): boolean {
    console.log('\n  Mindlore Health Check\n');

    for (const r of this.results) {
      const icon =
        r.status === 'PASS' ? '+' : r.status === 'WARN' ? '~' : '-';
      console.log(`  [${icon}] ${r.name}: ${r.detail}`);
    }

    const total = this.passed + this.failed + this.warnings;
    console.log(
      `\n  Score: ${this.passed}/${total} passed, ${this.warnings} warnings, ${this.failed} failed\n`,
    );

    return this.failed === 0;
  }
}

// ── Main ───────────────────────────────────────────────────────────────

export interface DashboardResult {
  stale: number;
  orphan: number;
  lowQuality: number;
  recent: number;
}

export function getHealthDashboard(db: Database, baseDir: string): DashboardResult {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const staleRow = dbGet<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM file_hashes WHERE last_indexed < ?", ninetyDaysAgo);
  const stale = staleRow?.cnt ?? 0;

  let lowQuality = 0;
  try {
    const lqRow = dbGet<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM mindlore_fts WHERE quality = 'low' OR quality IS NULL");
    lowQuality = lqRow?.cnt ?? 0;
  } catch { /* FTS table may differ */ }

  const recentRow = dbGet<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM file_hashes WHERE last_indexed > ?", sevenDaysAgo);
  const recent = recentRow?.cnt ?? 0;

  const rawDir = path.join(baseDir, 'raw');
  const sourcesDir = path.join(baseDir, 'sources');
  let orphan = 0;
  if (fs.existsSync(rawDir)) {
    const rawFiles = fs.readdirSync(rawDir).filter(f => f.endsWith('.md'));
    const sourceFiles = fs.existsSync(sourcesDir)
      ? new Set(fs.readdirSync(sourcesDir).filter(f => f.endsWith('.md')))
      : new Set<string>();
    orphan = rawFiles.filter(f => !sourceFiles.has(f)).length;
  }

  return { stale, orphan, lowQuality, recent };
}

function main(): void {
  const baseDir = process.argv[2] ?? GLOBAL_MINDLORE_DIR;

  if (!fs.existsSync(baseDir)) {
    console.error(`  .mindlore/ not found at: ${baseDir}`);
    console.error('  Run: npx mindlore init');
    process.exit(1);
  }

  const checker = new HealthChecker(baseDir);
  const healthy = checker.run().report();

  try {
    withReadonlyDb(baseDir, (db) => {
      const d = getHealthDashboard(db, baseDir);
      console.log('  Knowledge Dashboard:');
      console.log(`    Stale (90d+): ${d.stale} | Orphan raw: ${d.orphan} | Low quality: ${d.lowQuality} | Recent (7d): ${d.recent}\n`);
    });
  } catch { /* dashboard is optional */ }

  process.exit(healthy ? 0 : 1);
}

const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) main();
