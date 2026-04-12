#!/usr/bin/env node

/**
 * mindlore quality-populate — Bulk-assign quality to sources with null/missing quality.
 *
 * Usage: node dist/scripts/quality-populate.js [--global]
 *
 * Scans .mindlore/sources/ for files with missing quality in frontmatter,
 * assigns quality based on source_type heuristic, updates frontmatter + FTS5.
 */

import fs from 'fs';
import path from 'path';
import { GLOBAL_MINDLORE_DIR, DB_NAME, QUALITY_HEURISTICS, isContentFile, log, resolveHookCommon } from './lib/constants.js';
import type { QualityValue } from './lib/constants.js';

const { parseFrontmatter, openDatabase } = require(resolveHookCommon(__dirname)) as {
  parseFrontmatter: (content: string) => { meta: Record<string, unknown>; body: string };
  openDatabase: (dbPath: string, opts?: { readonly?: boolean }) => import('better-sqlite3').Database | null;
};

function resolveQuality(meta: Record<string, unknown>): QualityValue {
  const sourceType = String(meta.source_type || '').toLowerCase();
  if (sourceType && QUALITY_HEURISTICS[sourceType]) {
    return QUALITY_HEURISTICS[sourceType];
  }
  // URL-based fallback when source_type is missing
  const url = String(meta.source_url || '');
  if (url.includes('github.com')) return 'high';
  if (url.includes('docs.') || url.includes('developer.')) return 'high';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'medium';
  return 'medium';
}

function updateFrontmatter(content: string, meta: Record<string, unknown>, quality: QualityValue): string {
  if (meta.quality) {
    return content.replace(/^quality:\s*.*/m, `quality: ${quality}`);
  }
  return content.replace(/\n---\n/, `\nquality: ${quality}\n---\n`);
}

function main(): void {
  const baseDir = GLOBAL_MINDLORE_DIR;
  const sourcesDir = path.join(baseDir, 'sources');

  if (!fs.existsSync(sourcesDir)) {
    console.log('No sources/ directory found.');
    return;
  }

  const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith('.md') && isContentFile(f));
  const dbPath = path.join(baseDir, DB_NAME);

  // Open DB once before loop
  const db = fs.existsSync(dbPath) ? openDatabase(dbPath) : null;

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(sourcesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const { meta } = parseFrontmatter(content);

    // Skip if quality already set
    if (meta.quality && meta.quality !== 'null' && meta.quality !== '') {
      skipped++;
      continue;
    }

    const quality = resolveQuality(meta);
    const newContent = updateFrontmatter(content, meta, quality);
    fs.writeFileSync(filePath, newContent, 'utf8');

    // Update FTS5
    if (db) {
      try {
        const row = db.prepare('SELECT rowid FROM mindlore_fts WHERE path = ?').get(filePath) as { rowid: number } | undefined;
        if (row) {
          db.prepare('UPDATE mindlore_fts SET quality = ? WHERE rowid = ?').run(quality, row.rowid);
        }
      } catch (_err) {
        // FTS5 update failure is non-fatal
      }
    }

    log(`${file}: quality → ${quality}`);
    updated++;
  }

  db?.close();

  console.log(`\n  Quality populate: ${updated} updated, ${skipped} already set (${files.length} total)`);
}

main();
