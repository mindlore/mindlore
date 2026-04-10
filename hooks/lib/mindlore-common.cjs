'use strict';

/**
 * Shared utilities for mindlore hooks.
 * Eliminates duplication of findMindloreDir, getLatestDelta, sha256, etc.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const MINDLORE_DIR = '.mindlore';
const DB_NAME = 'mindlore.db';
const SKIP_FILES = new Set(['INDEX.md', 'SCHEMA.md', 'log.md']);

function findMindloreDir() {
  const projectDir = path.join(process.cwd(), MINDLORE_DIR);
  if (fs.existsSync(projectDir)) return projectDir;

  const globalDir = path.join(os.homedir(), MINDLORE_DIR);
  if (fs.existsSync(globalDir)) return globalDir;

  return null;
}

function getLatestDelta(diaryDir) {
  if (!fs.existsSync(diaryDir)) return null;

  const deltas = fs
    .readdirSync(diaryDir)
    .filter((f) => f.startsWith('delta-') && f.endsWith('.md'))
    .sort()
    .reverse();

  if (deltas.length === 0) return null;
  return path.join(diaryDir, deltas[0]);
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function requireDatabase() {
  try {
    return require('better-sqlite3');
  } catch (_err) {
    return null;
  }
}

function openDatabase(dbPath, opts) {
  const Database = requireDatabase();
  if (!Database) return null;

  const db = new Database(dbPath, opts);
  if (!opts || !opts.readonly) {
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function getAllMdFiles(dir, skip) {
  const skipSet = skip || SKIP_FILES;
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllMdFiles(fullPath, skipSet));
    } else if (entry.name.endsWith('.md') && !skipSet.has(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

module.exports = {
  MINDLORE_DIR,
  DB_NAME,
  SKIP_FILES,
  findMindloreDir,
  getLatestDelta,
  sha256,
  requireDatabase,
  openDatabase,
  getAllMdFiles,
};
