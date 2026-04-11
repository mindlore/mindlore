#!/usr/bin/env node

/**
 * mindlore-fts5-index — Full re-index of .mindlore/ into FTS5 database.
 *
 * Scans all .md files, computes SHA256 content-hash, skips unchanged files.
 * Usage: node dist/scripts/mindlore-fts5-index.js [path-to-mindlore-dir]
 */

import fs from 'fs';
import path from 'path';
import { DB_NAME, resolveHookCommon } from './lib/constants.js';

 
const {
  sha256,
  getAllMdFiles,
  openDatabase,
  parseFrontmatter,
  extractFtsMetadata,
  insertFtsRow,
} = require(resolveHookCommon(__dirname)) as {
  sha256: (content: string) => string;
  getAllMdFiles: (dir: string) => string[];
  openDatabase: (dbPath: string) => import('better-sqlite3').Database | null;
  parseFrontmatter: (content: string) => { meta: Record<string, string>; body: string };
  extractFtsMetadata: (
    meta: Record<string, string>,
    body: string,
    filePath: string,
    baseDir: string,
  ) => {
    slug: string;
    description: string;
    type: string;
    category: string;
    title: string;
    tags: string;
    quality: string | null;
    dateCaptured: string | null;
  };
  insertFtsRow: (db: import('better-sqlite3').Database, entry: {
    path: string; slug?: string; description?: string; type?: string;
    category?: string; title?: string; content?: string; tags?: string;
    quality?: string | null; dateCaptured?: string | null;
  }) => void;
};

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  const baseDir = process.argv[2] ?? path.join(process.cwd(), '.mindlore');
  const dbPath = path.join(baseDir, DB_NAME);

  if (!fs.existsSync(dbPath)) {
    console.error('  Database not found. Run: npx mindlore init');
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  if (!db) {
    console.error('  better-sqlite3 not installed. Run: npm install better-sqlite3');
    process.exit(1);
  }

  const getHash = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?');
  const upsertHash = db.prepare(`
    INSERT INTO file_hashes (path, content_hash, last_indexed)
    VALUES (?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      last_indexed = excluded.last_indexed
  `);
  const deleteFts = db.prepare('DELETE FROM mindlore_fts WHERE path = ?');

  const mdFiles = getAllMdFiles(baseDir) as string[];
  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    for (const filePath of mdFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
        const hash = sha256(content);

        const existing = getHash.get(filePath) as { content_hash: string } | undefined;
        if (existing && existing.content_hash === hash) {
          skipped++;
          continue;
        }

        const { meta, body } = parseFrontmatter(content);
        const { slug, description, type, category, title, tags, quality, dateCaptured } =
          extractFtsMetadata(meta, body, filePath, baseDir);
        deleteFts.run(filePath);
        insertFtsRow(db, { path: filePath, slug, description, type, category, title, content: body, tags, quality, dateCaptured });

        upsertHash.run(filePath, hash, now);
        indexed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  Error indexing ${path.basename(filePath)}: ${message}`);
        errors++;
      }
    }
  });

  transaction();

  const allIndexed = db.prepare('SELECT path FROM file_hashes').all() as Array<{ path: string }>;
  const existingPaths = new Set(mdFiles);
  let removed = 0;

  const deleteHash = db.prepare('DELETE FROM file_hashes WHERE path = ?');
  const cleanupTransaction = db.transaction(() => {
    for (const row of allIndexed) {
      if (!existingPaths.has(row.path)) {
        deleteFts.run(row.path);
        deleteHash.run(row.path);
        removed++;
      }
    }
  });

  cleanupTransaction();
  db.close();

  console.log(
    `\n  FTS5 Index: ${indexed} indexed, ${skipped} unchanged, ${removed} removed, ${errors} errors\n`,
  );

  process.exit(errors > 0 ? 1 : 0);
}

main();
