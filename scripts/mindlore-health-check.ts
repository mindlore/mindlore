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
import { DIRECTORIES, TYPE_TO_DIR, DB_NAME, resolveHookCommon, isContentFile } from './lib/constants.js';

const { detectSchemaVersion } = require(resolveHookCommon(__dirname)) as { detectSchemaVersion: (db: unknown) => number };

 
const {
  parseFrontmatter: _parseFm,
  getAllMdFiles: _getAllMd,
} = require(resolveHookCommon(__dirname)) as {
  parseFrontmatter: (content: string) => { meta: Record<string, string>; body: string };
  getAllMdFiles: (dir: string, skipFiles?: Set<string>) => string[];
};

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
    this.check('mindlore.db FTS5', () => {
      const dbPath = path.join(this.baseDir, DB_NAME);
      if (!fs.existsSync(dbPath)) {
        return { ok: false, detail: 'database missing' };
      }

      let Database: typeof import('better-sqlite3');
      try {
        Database = require('better-sqlite3');
      } catch (_err) {
        return { warn: true, detail: 'better-sqlite3 not available, cannot verify' };
      }

      const db = new Database(dbPath, { readonly: true });
      try {
        const result = db.prepare('SELECT count(*) as cnt FROM mindlore_fts').get() as { cnt: number };
        const hashResult = db
          .prepare('SELECT count(*) as cnt FROM file_hashes')
          .get() as { cnt: number };

        const schemaVersion = detectSchemaVersion(db);

        if (schemaVersion < 10) {
          return {
            warn: true,
            detail: `${result.cnt} indexed, ${hashResult.cnt} hashes — ${schemaVersion}-col schema (run: npx mindlore init to upgrade to 10-col)`,
          };
        }

        return {
          ok: true,
          detail: `${result.cnt} indexed, ${hashResult.cnt} hashes, 10-col schema`,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, detail: `FTS5 error: ${message}` };
      } finally {
        db.close();
      }
    });
  }

  checkOrphans(): void {
    this.check('Orphan files', () => {
      const dbPath = path.join(this.baseDir, DB_NAME);
      if (!fs.existsSync(dbPath)) {
        return { warn: true, detail: 'no database, cannot check' };
      }

      let Database: typeof import('better-sqlite3');
      try {
        Database = require('better-sqlite3');
      } catch (_err) {
        return { warn: true, detail: 'better-sqlite3 not available' };
      }

      const mdFiles = getAllMdFiles(this.baseDir).filter(isContentFile);

      const db = new Database(dbPath, { readonly: true });
      try {
        const indexed = new Set<string>();
        const rows = db.prepare('SELECT path FROM file_hashes').all() as Array<{ path: string }>;
        for (const row of rows) {
          indexed.add(path.resolve(row.path));
        }

        const orphans = mdFiles.filter(
          (f) => !indexed.has(path.resolve(f)),
        );

        if (orphans.length === 0) {
          return { ok: true, detail: 'no orphans' };
        }
        if (orphans.length <= 3) {
          return {
            warn: true,
            detail: `${orphans.length} unindexed: ${orphans.map((f) => path.basename(f)).join(', ')}`,
          };
        }
        return {
          ok: false,
          detail: `${orphans.length} unindexed files — run: npm run index`,
        };
      } finally {
        db.close();
      }
    });
  }

  checkFrontmatter(): void {
    this.check('Frontmatter: slug + type', () => {
      const mdFiles = getAllMdFiles(this.baseDir).filter(isContentFile);

      let missingSlug = 0;
      let missingType = 0;
      let wrongDir = 0;

      for (const file of mdFiles) {
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
          if (parentDir !== expectedDir) {
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

  run(): this {
    this.checkDirectories();
    this.checkSchema();
    this.checkIndex();
    this.checkDatabase();
    this.checkOrphans();
    this.checkFrontmatter();
    this.checkStaleDeltas();
    this.checkConflictingAnalyses();
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

function main(): void {
  const baseDir = process.argv[2] ?? path.join(process.cwd(), '.mindlore');

  if (!fs.existsSync(baseDir)) {
    console.error(`  .mindlore/ not found at: ${baseDir}`);
    console.error('  Run: npx mindlore init');
    process.exit(1);
  }

  const checker = new HealthChecker(baseDir);
  const healthy = checker.run().report();
  process.exit(healthy ? 0 : 1);
}

main();
