#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { GLOBAL_MINDLORE_DIR, DB_NAME } from './lib/constants.js';

export interface CleanupReport {
  fts5Gaps: string[];
  backfilled: string[];
  errors: string[];
}

interface CleanupOptions {
  baseDir?: string;
  dryRun?: boolean;
}

const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatterSimple(content: string): { meta: Record<string, string>; body: string; raw: string } | null {
  const match = content.match(FM_REGEX);
  if (!match || !match[1]) return null;
  const raw: string = match[1];
  const meta: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  }
  const body = content.slice(match[0].length);
  return { meta, body, raw };
}

function getAllMdFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllMdFilesRecursive(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function deriveProjectFromPath(filePath: string, baseDir: string): string | null {
  const rel = path.relative(path.join(baseDir, 'raw', 'sessions'), filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  const first = parts[0];
  if (parts.length >= 2 && first && !first.startsWith('..')) {
    return first;
  }
  return null;
}

export async function runCleanup(opts: CleanupOptions = {}): Promise<CleanupReport> {
  const baseDir = opts.baseDir ?? GLOBAL_MINDLORE_DIR;
  const dryRun = opts.dryRun ?? true;

  const report: CleanupReport = {
    fts5Gaps: [],
    backfilled: [],
    errors: [],
  };

  const rawDir = path.join(baseDir, 'raw');
  const allFiles = getAllMdFilesRecursive(rawDir);

  // --- Backfill missing project frontmatter ---
  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const parsed = parseFrontmatterSimple(content);
      if (!parsed) continue;
      if (parsed.meta['project']) continue;

      const project = deriveProjectFromPath(file, baseDir);
      if (!project) continue;

      if (!dryRun) {
        const newFm = parsed.raw + '\nproject: ' + project;
        const newContent = content.replace(parsed.raw, newFm);
        fs.writeFileSync(file, newContent, 'utf8');
      }
      report.backfilled.push(file);
    } catch (err) {
      report.errors.push(`backfill error ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- FTS5 gap detection ---
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
              r => r.path.replace(/\\/g, '/')
            )
          );
          for (const file of allFiles) {
            const normalized = file.replace(/\\/g, '/');
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
