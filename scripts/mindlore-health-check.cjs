#!/usr/bin/env node
'use strict';

/**
 * mindlore-health-check — 16-point structural health check for .mindlore/
 *
 * Usage: node scripts/mindlore-health-check.cjs [path-to-mindlore-dir]
 *
 * Exit codes: 0 = healthy, 1 = issues found
 */

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────

const { DIRECTORIES, TYPE_TO_DIR } = require('./lib/constants.cjs');

// ── Helpers ────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fm = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Handle arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim());
    }
    fm[key] = value;
  }
  return fm;
}

// Health check needs ALL .md files (no skip), so pass empty set
function getAllMdFiles(dir) {
  return require('../hooks/lib/mindlore-common.cjs').getAllMdFiles(dir, new Set());
}

// ── Checks ─────────────────────────────────────────────────────────────

class HealthChecker {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.results = [];
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
  }

  check(name, fn) {
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
      this.results.push({ name, status: 'FAIL', detail: err.message });
    }
  }

  // Check 1-9: Directory existence
  checkDirectories() {
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

  // Check 10: SCHEMA.md parseable
  checkSchema() {
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

  // Check 11: INDEX.md format
  checkIndex() {
    this.check('INDEX.md format', () => {
      const indexPath = path.join(this.baseDir, 'INDEX.md');
      if (!fs.existsSync(indexPath)) {
        return { ok: false, detail: 'missing' };
      }
      const content = fs.readFileSync(indexPath, 'utf8');
      const lines = content.trim().split('\n');
      if (lines.length > 30) {
        return {
          warn: true,
          detail: `${lines.length} lines (should be ~15-20, consider trimming)`,
        };
      }
      return { ok: true, detail: `${lines.length} lines` };
    });
  }

  // Check 12: Database integrity
  checkDatabase() {
    this.check('mindlore.db FTS5', () => {
      const dbPath = path.join(this.baseDir, 'mindlore.db');
      if (!fs.existsSync(dbPath)) {
        return { ok: false, detail: 'database missing' };
      }

      let Database;
      try {
        Database = require('better-sqlite3');
      } catch (_err) {
        return { warn: true, detail: 'better-sqlite3 not available, cannot verify' };
      }

      const db = new Database(dbPath, { readonly: true });
      try {
        const result = db.prepare('SELECT count(*) as cnt FROM mindlore_fts').get();
        const hashResult = db
          .prepare('SELECT count(*) as cnt FROM file_hashes')
          .get();
        return {
          ok: true,
          detail: `${result.cnt} indexed, ${hashResult.cnt} hashes`,
        };
      } catch (err) {
        return { ok: false, detail: `FTS5 error: ${err.message}` };
      } finally {
        db.close();
      }
    });
  }

  // Check 13: Orphan files (in .mindlore/ but not in FTS5)
  checkOrphans() {
    this.check('Orphan files', () => {
      const dbPath = path.join(this.baseDir, 'mindlore.db');
      if (!fs.existsSync(dbPath)) {
        return { warn: true, detail: 'no database, cannot check' };
      }

      let Database;
      try {
        Database = require('better-sqlite3');
      } catch (_err) {
        return { warn: true, detail: 'better-sqlite3 not available' };
      }

      const mdFiles = getAllMdFiles(this.baseDir).filter(
        (f) =>
          !f.endsWith('INDEX.md') &&
          !f.endsWith('SCHEMA.md') &&
          !f.endsWith('log.md')
      );

      const db = new Database(dbPath, { readonly: true });
      try {
        const indexed = new Set();
        const rows = db.prepare('SELECT path FROM file_hashes').all();
        for (const row of rows) {
          indexed.add(path.resolve(row.path));
        }

        const orphans = mdFiles.filter(
          (f) => !indexed.has(path.resolve(f))
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

  // Check 14-16: Frontmatter validation
  checkFrontmatter() {
    this.check('Frontmatter: slug + type', () => {
      const mdFiles = getAllMdFiles(this.baseDir).filter(
        (f) =>
          !f.endsWith('INDEX.md') &&
          !f.endsWith('SCHEMA.md') &&
          !f.endsWith('log.md')
      );

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

        // Check type-directory match
        const expectedDir = TYPE_TO_DIR[fm.type];
        if (expectedDir) {
          const parentDir = path.basename(path.dirname(file));
          if (parentDir !== expectedDir) {
            wrongDir++;
          }
        }
      }

      const issues = [];
      if (missingSlug > 0) issues.push(`${missingSlug} missing slug`);
      if (missingType > 0) issues.push(`${missingType} missing type`);
      if (wrongDir > 0) issues.push(`${wrongDir} type-dir mismatch`);

      if (issues.length === 0) {
        return {
          ok: true,
          detail: `${mdFiles.length} files validated`,
        };
      }
      return {
        ok: wrongDir > 0 ? false : undefined,
        warn: wrongDir === 0,
        detail: issues.join(', '),
      };
    });
  }

  // ── Run all ────────────────────────────────────────────────────────

  run() {
    this.checkDirectories();
    this.checkSchema();
    this.checkIndex();
    this.checkDatabase();
    this.checkOrphans();
    this.checkFrontmatter();
    return this;
  }

  report() {
    console.log('\n  Mindlore Health Check\n');

    for (const r of this.results) {
      const icon =
        r.status === 'PASS' ? '+' : r.status === 'WARN' ? '~' : '-';
      console.log(`  [${icon}] ${r.name}: ${r.detail}`);
    }

    const total = this.passed + this.failed + this.warnings;
    console.log(
      `\n  Score: ${this.passed}/${total} passed, ${this.warnings} warnings, ${this.failed} failed\n`
    );

    return this.failed === 0;
  }
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  const baseDir = process.argv[2] || path.join(process.cwd(), '.mindlore');

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
