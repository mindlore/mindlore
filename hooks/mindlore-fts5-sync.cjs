#!/usr/bin/env node
'use strict';

/**
 * mindlore-fts5-sync — FileChanged hook (incremental re-index)
 *
 * Handles bulk file changes by checking all .mindlore/ .md files
 * against their content hashes and re-indexing only changed ones.
 *
 * Lightweight complement to mindlore-index.cjs which handles single files.
 * This hook catches cases where multiple files change at once (e.g., git pull).
 */

const fs = require('fs');
const path = require('path');
const { MINDLORE_DIR, DB_NAME, sha256, requireDatabase, getAllMdFiles } = require('./lib/mindlore-common.cjs');

function main() {
  // Read stdin to check if this is a .mindlore/ file change
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8').trim();
  } catch (_err) {
    // No stdin — skip
  }

  let filePath = '';
  try {
    const parsed = JSON.parse(input);
    filePath = parsed.path || parsed.file_path || '';
  } catch (_err) {
    filePath = input;
  }

  // Only trigger on .mindlore/ changes (empty filePath = skip)
  if (!filePath || !filePath.includes(MINDLORE_DIR)) return;

  const baseDir = path.join(process.cwd(), MINDLORE_DIR);
  if (!fs.existsSync(baseDir)) return;

  const dbPath = path.join(baseDir, DB_NAME);
  if (!fs.existsSync(dbPath)) return;

  const Database = requireDatabase();
  if (!Database) return;

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const mdFiles = getAllMdFiles(baseDir);
  let synced = 0;

  const getHash = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?');
  const deleteFts = db.prepare('DELETE FROM mindlore_fts WHERE path = ?');
  const insertFts = db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)');
  const upsertHash = db.prepare(`
    INSERT INTO file_hashes (path, content_hash, last_indexed)
    VALUES (?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      last_indexed = excluded.last_indexed
  `);

  const now = new Date().toISOString();

  try {
    const transaction = db.transaction(() => {
      for (const file of mdFiles) {
        const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        const hash = sha256(content);

        const existing = getHash.get(file);
        if (existing && existing.content_hash === hash) continue;

        deleteFts.run(file);
        insertFts.run(file, content);
        upsertHash.run(file, hash, now);
        synced++;
      }
    });
    transaction();
  } finally {
    db.close();
  }

  if (synced > 0) {
    process.stderr.write(`[Mindlore FTS5 Sync: ${synced} files re-indexed]\n`);
  }
}

main();
