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

interface HookCommon {
  parseFrontmatter: (content: string) => { meta: Record<string, unknown>; body: string };
  openDatabase: (dbPath: string, opts?: { readonly?: boolean }) => import('better-sqlite3').Database | null;
}
const { parseFrontmatter, openDatabase }: HookCommon = require(resolveHookCommon(__dirname));

function resolveQuality(meta: Record<string, unknown>): QualityValue {
  const sourceType = String(meta.source_type || '').toLowerCase();
  if (sourceType && QUALITY_HEURISTICS[sourceType]) {
    return QUALITY_HEURISTICS[sourceType];
  }
  // URL-based fallback when source_type is missing
  let hostname = '';
  try { hostname = new URL(String(meta.source_url || '')).hostname; } catch { /* invalid URL */ }
  if (hostname === 'github.com' || hostname.endsWith('.github.com')) return 'high';
  if (hostname.startsWith('docs.') || hostname.startsWith('developer.')) return 'high';
  if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'youtu.be') return 'medium';
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
  const getRowid = db?.prepare('SELECT rowid FROM mindlore_fts WHERE path = ?');
  const updateQuality = db?.prepare('UPDATE mindlore_fts SET quality = ? WHERE rowid = ?');

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
    if (getRowid && updateQuality) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pre-prepared stmt in loop
        const row = getRowid.get(filePath) as { rowid: number } | undefined;
        if (row) {
          updateQuality.run(quality, row.rowid);
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
