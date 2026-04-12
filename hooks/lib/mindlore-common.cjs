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

/**
 * Compute global .mindlore/ path at call time.
 * Separate function so os.homedir() is evaluated lazily (testable).
 */
function globalDir() {
  return path.join(os.homedir(), MINDLORE_DIR);
}

// Convenience export — snapshot at load time for simple references.
const GLOBAL_MINDLORE_DIR = globalDir();

function findMindloreDir() {
  const projectDir = path.join(process.cwd(), MINDLORE_DIR);
  if (fs.existsSync(projectDir)) return projectDir;

  const gDir = globalDir();
  if (fs.existsSync(gDir)) return gDir;

  return null;
}

/**
 * Always returns a .mindlore/ path — project if exists, otherwise global.
 * Unlike findMindloreDir, never returns null.
 */
function getActiveMindloreDir() {
  const projectDir = path.join(process.cwd(), MINDLORE_DIR);
  if (fs.existsSync(projectDir)) return projectDir;
  return globalDir();
}

/**
 * Return all existing mindlore DB paths (project first, global second).
 * Used for layered search: project results ranked higher.
 */
function getAllDbs() {
  const dbs = [];
  const projectDb = path.join(process.cwd(), MINDLORE_DIR, DB_NAME);
  const gDb = path.join(globalDir(), DB_NAME);

  if (fs.existsSync(projectDb)) dbs.push(projectDb);
  if (fs.existsSync(gDb) && gDb !== projectDb) dbs.push(gDb);

  return dbs;
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

/**
 * Parse YAML frontmatter from markdown content.
 * Returns { meta: { key: value }, body: string }
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    }
    if (typeof value === 'string') {
      value = value.replace(/^["']|["']$/g, '');
    }
    meta[key] = value;
  }

  const bodyStart = content.indexOf('---', 3);
  const body = bodyStart !== -1 ? content.slice(bodyStart + 3).replace(/^\r?\n/, '') : content;

  return { meta, body };
}

/**
 * Extract FTS5 metadata from parsed frontmatter + file path.
 * Returns { slug, description, type, category, title }
 */
function extractFtsMetadata(meta, body, filePath, baseDir) {
  const slug = meta.slug || path.basename(filePath, '.md');
  const description = meta.description || '';
  const type = meta.type || '';
  const relativePath = baseDir ? path.relative(baseDir, filePath) : filePath;
  const category = path.dirname(relativePath).split(path.sep)[0] || 'root';
  let title = meta.title || meta.name || '';
  if (!title) {
    const headingMatch = body.match(/^#\s+(.+)/m);
    title = headingMatch ? headingMatch[1].trim() : path.basename(filePath, '.md');
  }
  let tags = '';
  if (meta.tags) {
    tags = Array.isArray(meta.tags) ? meta.tags.join(', ') : String(meta.tags);
  }
  const quality = meta.quality !== undefined && meta.quality !== null ? meta.quality : null;
  const dateCaptured = meta.date_captured || meta.date || null;
  return { slug, description, type, category, title, tags, quality, dateCaptured };
}

/**
 * Shared SQL constants to prevent drift across indexing paths.
 */
const SQL_FTS_CREATE =
  "CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(path UNINDEXED, slug, description, type UNINDEXED, category, title, content, tags, quality UNINDEXED, date_captured UNINDEXED, tokenize='porter unicode61')";

const SQL_FTS_INSERT =
  'INSERT INTO mindlore_fts (path, slug, description, type, category, title, content, tags, quality, date_captured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

/**
 * Insert a row into FTS5 using an object parameter (replaces positional args).
 */
function insertFtsRow(db, entry) {
  const stmt = db.prepare(SQL_FTS_INSERT);
  stmt.run(
    entry.path || '',
    entry.slug || '',
    entry.description || '',
    entry.type || '',
    entry.category || '',
    entry.title || '',
    entry.content || '',
    entry.tags || '',
    entry.quality || null,
    entry.dateCaptured || null,
  );
}

/**
 * Extract headings (h1-h3) from markdown content.
 */
function extractHeadings(content, max) {
  const headings = [];
  for (const line of content.split('\n')) {
    if (/^#{1,3}\s/.test(line)) {
      headings.push(line.replace(/^#+\s*/, '').trim());
      if (headings.length >= max) break;
    }
  }
  return headings;
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

/**
 * Read CC hook stdin and parse JSON envelope.
 * Returns the value of the first matching field, or raw text as fallback.
 * @param {string[]} fields - Priority-ordered field names to extract
 */
function readHookStdin(fields) {
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8').trim();
  } catch (_err) {
    return '';
  }
  if (!input) return '';
  try {
    const parsed = JSON.parse(input);
    for (const f of fields) {
      if (parsed[f]) return parsed[f];
    }
  } catch (_err) {
    // plain text
  }
  return input;
}

/**
 * Read .mindlore/config.json and return parsed object.
 * Returns null if file doesn't exist or is invalid JSON.
 */
function readConfig(mindloreDir) {
  if (!mindloreDir) return null;
  const configPath = path.join(mindloreDir, 'config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_err) {
    return null;
  }
}

/**
 * Detect FTS5 schema version by probing columns.
 * FTS5 virtual tables don't support PRAGMA table_info, so try/catch is required.
 * @param {import('better-sqlite3').Database} db
 * @returns {number} 2 | 7 | 9 | 10
 */
function detectSchemaVersion(db) {
  try {
    db.prepare('SELECT tags, quality, date_captured FROM mindlore_fts LIMIT 0').run();
    return 10;
  } catch (_err) {
    try {
      db.prepare('SELECT tags, quality FROM mindlore_fts LIMIT 0').run();
      return 9;
    } catch (_err2) {
      try {
        db.prepare('SELECT slug, description, category, title FROM mindlore_fts LIMIT 0').run();
        return 7;
      } catch (_err3) {
        return 2;
      }
    }
  }
}

const DEFAULT_MODELS = {
  ingest: 'haiku',
  evolve: 'sonnet',
  explore: 'sonnet',
  default: 'haiku',
};

module.exports = {
  MINDLORE_DIR,
  GLOBAL_MINDLORE_DIR,
  globalDir,
  DB_NAME,
  SKIP_FILES,
  findMindloreDir,
  getActiveMindloreDir,
  getAllDbs,
  getLatestDelta,
  sha256,
  parseFrontmatter,
  extractFtsMetadata,
  readHookStdin,
  SQL_FTS_CREATE,
  SQL_FTS_INSERT,
  insertFtsRow,
  extractHeadings,
  requireDatabase,
  openDatabase,
  getAllMdFiles,
  readConfig,
  detectSchemaVersion,
  DEFAULT_MODELS,
};
