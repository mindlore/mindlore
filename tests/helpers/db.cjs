'use strict';

/**
 * Shared test helpers for mindlore test suites.
 * Eliminates duplication of DB setup, teardown, and sha256 across test files.
 */

const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function createTestDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts
    USING fts5(path, content, tokenize='unicode61');
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_hashes (
      path TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      last_indexed TEXT NOT NULL
    );
  `);
  return db;
}

function setupTestDir(testDir, subdirs) {
  const dirs = subdirs || [];
  fs.mkdirSync(testDir, { recursive: true });
  for (const sub of dirs) {
    fs.mkdirSync(require('path').join(testDir, sub), { recursive: true });
  }
}

function teardownTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

module.exports = {
  sha256,
  createTestDb,
  setupTestDir,
  teardownTestDir,
};
