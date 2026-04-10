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
const crypto = require('crypto');

const MINDLORE_DIR = '.mindlore';
const DB_NAME = 'mindlore.db';
const SKIP_FILES = new Set(['INDEX.md', 'SCHEMA.md', 'log.md']);

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function main() {
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8').trim();
  } catch (_err) {
    return;
  }

  let filePath = '';
  try {
    const parsed = JSON.parse(input);
    filePath = parsed.path || parsed.file_path || '';
  } catch (_err) {
    filePath = input;
  }

  if (!filePath) return;

  // Only process .md files inside .mindlore/
  if (!filePath.includes(MINDLORE_DIR) || !filePath.endsWith('.md')) return;

  const fileName = path.basename(filePath);
  if (SKIP_FILES.has(fileName)) return;

  // Find the .mindlore dir from the file path
  const mindloreIdx = filePath.indexOf(MINDLORE_DIR);
  const baseDir = filePath.slice(0, mindloreIdx + MINDLORE_DIR.length);
  const dbPath = path.join(baseDir, DB_NAME);

  if (!fs.existsSync(dbPath)) return;
  if (!fs.existsSync(filePath)) {
    // File was deleted — remove from index
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (_err) {
      return;
    }
    const db = new Database(dbPath);
    try {
      db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
      db.prepare('DELETE FROM file_hashes WHERE path = ?').run(filePath);
    } finally {
      db.close();
    }
    return;
  }

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (_err) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const hash = sha256(content);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  try {
    // Check if content changed
    const existing = db
      .prepare('SELECT content_hash FROM file_hashes WHERE path = ?')
      .get(filePath);

    if (existing && existing.content_hash === hash) return; // Unchanged

    // Update FTS5
    db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      filePath,
      content
    );

    // Update hash
    db.prepare(
      `INSERT INTO file_hashes (path, content_hash, last_indexed)
       VALUES (?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         content_hash = excluded.content_hash,
         last_indexed = excluded.last_indexed`
    ).run(filePath, hash, new Date().toISOString());
  } finally {
    db.close();
  }
}

main();
