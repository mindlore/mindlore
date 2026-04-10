#!/usr/bin/env node
'use strict';

/**
 * mindlore-fts5-index — Full re-index of .mindlore/ into FTS5 database.
 *
 * Scans all .md files, computes SHA256 content-hash, skips unchanged files.
 * Usage: node scripts/mindlore-fts5-index.cjs [path-to-mindlore-dir]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Constants ──────────────────────────────────────────────────────────

const SKIP_FILES = new Set(['INDEX.md', 'SCHEMA.md', 'log.md']);
const DB_NAME = 'mindlore.db';

// ── Helpers ────────────────────────────────────────────────────────────

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function getAllMdFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllMdFiles(fullPath));
    } else if (entry.name.endsWith('.md') && !SKIP_FILES.has(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  const baseDir = process.argv[2] || path.join(process.cwd(), '.mindlore');
  const dbPath = path.join(baseDir, DB_NAME);

  if (!fs.existsSync(dbPath)) {
    console.error('  Database not found. Run: npx mindlore init');
    process.exit(1);
  }

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (_err) {
    console.error('  better-sqlite3 not installed. Run: npm install better-sqlite3');
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Prepare statements
  const getHash = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?');
  const upsertHash = db.prepare(`
    INSERT INTO file_hashes (path, content_hash, last_indexed)
    VALUES (?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      last_indexed = excluded.last_indexed
  `);
  const deleteFts = db.prepare('DELETE FROM mindlore_fts WHERE path = ?');
  const insertFts = db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)');

  // Get all .md files
  const mdFiles = getAllMdFiles(baseDir);
  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    for (const filePath of mdFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
        const hash = sha256(content);

        // Check if content changed
        const existing = getHash.get(filePath);
        if (existing && existing.content_hash === hash) {
          skipped++;
          continue;
        }

        // Update FTS5
        deleteFts.run(filePath);
        insertFts.run(filePath, content);

        // Update hash
        upsertHash.run(filePath, hash, now);
        indexed++;
      } catch (err) {
        console.error(`  Error indexing ${path.basename(filePath)}: ${err.message}`);
        errors++;
      }
    }
  });

  transaction();

  // Clean up entries for deleted files
  const allIndexed = db.prepare('SELECT path FROM file_hashes').all();
  const existingPaths = new Set(mdFiles);
  let removed = 0;

  const cleanupTransaction = db.transaction(() => {
    for (const row of allIndexed) {
      if (!existingPaths.has(row.path)) {
        deleteFts.run(row.path);
        db.prepare('DELETE FROM file_hashes WHERE path = ?').run(row.path);
        removed++;
      }
    }
  });

  cleanupTransaction();
  db.close();

  console.log(
    `\n  FTS5 Index: ${indexed} indexed, ${skipped} unchanged, ${removed} removed, ${errors} errors\n`
  );

  process.exit(errors > 0 ? 1 : 0);
}

main();
