#!/usr/bin/env node
'use strict';

/**
 * mindlore-index — FileChanged hook
 *
 * When a .md file in .mindlore/ changes, update its FTS5 entry.
 * Reads changed file path from stdin (CC FileChanged event).
 */

const fs = require('fs');
const path = require('path');
const { MINDLORE_DIR, DB_NAME, SKIP_FILES, sha256, openDatabase, parseFrontmatter, extractFtsMetadata, insertFtsRow, readHookStdin, getProjectName } = require('./lib/mindlore-common.cjs');

function main() {
  const filePath = readHookStdin(['path', 'file_path']);
  if (!filePath) return;

  // Only process .md files inside .mindlore/ (resolved path check prevents traversal)
  if (!filePath.endsWith('.md')) return;
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.includes(path.sep + MINDLORE_DIR + path.sep) && !resolvedFile.includes(path.sep + MINDLORE_DIR)) return;

  const fileName = path.basename(filePath);
  if (SKIP_FILES.has(fileName)) return;

  // Find the .mindlore dir from the file path
  const mindloreIdx = filePath.indexOf(MINDLORE_DIR);
  const baseDir = filePath.slice(0, mindloreIdx + MINDLORE_DIR.length);
  const dbPath = path.join(baseDir, DB_NAME);

  if (!fs.existsSync(dbPath)) return;

  if (!fs.existsSync(filePath)) {
    // File was deleted — remove from index
    const db = openDatabase(dbPath);
    if (!db) return;
    try {
      db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
      db.prepare('DELETE FROM file_hashes WHERE path = ?').run(filePath);
    } finally {
      db.close();
    }
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const hash = sha256(content);

  const db = openDatabase(dbPath);
  if (!db) return;

  try {
    // Check if content changed
    const existing = db
      .prepare('SELECT content_hash FROM file_hashes WHERE path = ?')
      .get(filePath);

    if (existing && existing.content_hash === hash) return; // Unchanged

    // Parse frontmatter for rich FTS5 columns
    const { meta, body } = parseFrontmatter(content);
    const { slug, description, type, category, title, tags, quality, dateCaptured } = extractFtsMetadata(meta, body, filePath, baseDir);

    // Update FTS5 + hash atomically
    const updateIndex = db.transaction(() => {
      db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
      insertFtsRow(db, { path: filePath, slug, description, type, category, title, content: body, tags, quality, dateCaptured, project: getProjectName() });
      db.prepare(
        `INSERT INTO file_hashes (path, content_hash, last_indexed)
         VALUES (?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           content_hash = excluded.content_hash,
           last_indexed = excluded.last_indexed`
      ).run(filePath, hash, new Date().toISOString());
    });
    updateIndex();
  } finally {
    db.close();
  }
}

main();
