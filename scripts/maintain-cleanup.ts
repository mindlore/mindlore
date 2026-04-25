#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { GLOBAL_MINDLORE_DIR, DB_NAME } from './lib/constants.js';

const common = require('../hooks/lib/mindlore-common.cjs') as {
  getAllMdFiles: (dir: string, skip: Set<string>) => string[];
  resolveProject: (ftsProject: string | null, filePath: string, cwdFallback: string | null) => string | null;
};

export interface CleanupReport {
  fts5Gaps: string[];
  backfilled: string[];
  errors: string[];
}

interface CleanupOptions {
  baseDir?: string;
  dryRun?: boolean;
}

const norm = (p: string): string => p.replace(/\\/g, '/');

export async function runCleanup(opts: CleanupOptions = {}): Promise<CleanupReport> {
  const baseDir = opts.baseDir ?? GLOBAL_MINDLORE_DIR;
  const dryRun = opts.dryRun ?? true;

  const report: CleanupReport = {
    fts5Gaps: [],
    backfilled: [],
    errors: [],
  };

  const rawDir = path.join(baseDir, 'raw');
  const allFiles = common.getAllMdFiles(rawDir, new Set());

  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) continue;
      const rawFm = fmMatch[0];
      if (/^project:\s/m.test(rawFm)) continue;

      const project = common.resolveProject(null, file, null);
      if (!project) continue;

      if (!dryRun) {
        const newContent = content.replace(/\n---/, `\nproject: ${project}\n---`);
        fs.writeFileSync(file, newContent, 'utf8');
      }
      report.backfilled.push(file);
    } catch (err) {
      report.errors.push(`backfill error ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const dbPath = path.join(baseDir, DB_NAME);
  if (fs.existsSync(dbPath)) {
    try {
      const Database: typeof import('better-sqlite3') = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mindlore_fts'").all();
        if (tables.length > 0) {
          const indexed = new Set(
            (db.prepare('SELECT path FROM mindlore_fts').all() as Array<{ path: string }>).map(  // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion -- FTS5 schema guarantees path column
              r => norm(r.path)
            )
          );
          for (const file of allFiles) {
            const normalized = norm(file);
            if (!indexed.has(normalized)) {
              report.fts5Gaps.push(normalized);
            }
          }
        }
      } finally {
        db.close();
      }
    } catch (err) {
      report.errors.push(`fts5 gap check error: ${(err as Error).message}`);
    }
  }

  return report;
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  runCleanup({ dryRun }).then(report => {
    console.log('=== Cleanup Report ===');
    console.log(`FTS5 gaps: ${report.fts5Gaps.length}`);
    for (const g of report.fts5Gaps) console.log(`  - ${g}`);
    console.log(`Backfilled: ${report.backfilled.length}`);
    for (const b of report.backfilled) console.log(`  - ${b}`);
    if (report.errors.length) {
      console.log(`Errors: ${report.errors.length}`);
      for (const e of report.errors) console.log(`  ! ${e}`);
    }
  });
}
