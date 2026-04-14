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
 * MINDLORE_HOME env var overrides for testing and custom installs.
 */
function globalDir() {
  if (process.env.MINDLORE_HOME) return process.env.MINDLORE_HOME;
  return path.join(os.homedir(), MINDLORE_DIR);
}

// Convenience export — snapshot at load time for simple references.
const GLOBAL_MINDLORE_DIR = globalDir();

/**
 * v0.3.3 Global-First: always returns global ~/.mindlore/ if it exists.
 */
function findMindloreDir() {
  const gDir = globalDir();
  if (fs.existsSync(gDir)) return gDir;
  return null;
}

/**
 * Always returns the global ~/.mindlore/ path.
 * v0.3.3: project scope removed — single global directory.
 */
function getActiveMindloreDir() {
  return globalDir();
}

/**
 * Return the single global mindlore DB path.
 * v0.3.3: multi-DB layered search removed — single global DB with project column.
 */
function getAllDbs() {
  const dbPath = path.join(globalDir(), DB_NAME);
  if (fs.existsSync(dbPath)) return [dbPath];
  return [];
}

/**
 * Get current project name from CWD basename.
 * Used as the `project` column value in FTS5.
 */
function getProjectName() {
  return path.basename(process.cwd());
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
  "CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(path UNINDEXED, slug, description, type UNINDEXED, category, title, content, tags, quality UNINDEXED, date_captured UNINDEXED, project UNINDEXED, tokenize='porter unicode61')";

const SQL_FTS_INSERT =
  'INSERT INTO mindlore_fts (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

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
    entry.project || null,
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
    db.prepare('SELECT tags, quality, date_captured, project FROM mindlore_fts LIMIT 0').run();
    return 11;
  } catch (_err11) {
    try {
      db.prepare('SELECT tags, quality, date_captured FROM mindlore_fts LIMIT 0').run();
      return 10;
    } catch (_err10) {
      try {
        db.prepare('SELECT tags, quality FROM mindlore_fts LIMIT 0').run();
        return 9;
      } catch (_err9) {
        try {
          db.prepare('SELECT slug, description, category, title FROM mindlore_fts LIMIT 0').run();
          return 7;
        } catch (_err7) {
          return 2;
        }
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

// ── Episodes (v0.4.0) ─────────────────────────────────────────────

const SQL_EPISODES_CREATE = `
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'project',
  project TEXT,
  summary TEXT NOT NULL,
  body TEXT,
  tags TEXT,
  entities TEXT,
  parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  supersedes TEXT,
  source TEXT,
  created_at TEXT NOT NULL
)`;

/**
 * Valid episode kinds. CO-EVOLUTION: mirrors EPISODE_KINDS in scripts/lib/episodes.ts
 */
// ~500 tokens context budget for multi-session inject
const MULTI_SESSION_TOKEN_CAP_CHARS = 2500;

const EPISODE_KINDS_CJS = ['session', 'decision', 'event', 'preference', 'learning', 'friction', 'discovery', 'nomination'];

/**
 * Valid episode statuses. CO-EVOLUTION: mirrors EPISODE_STATUSES in scripts/lib/episodes.ts
 */
const EPISODE_STATUSES_CJS = ['active', 'superseded', 'deleted', 'staged', 'reviewed', 'approved', 'rejected'];

const SQL_EPISODES_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_episodes_kind ON episodes(kind, status)',
  'CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project, status)',
  'CREATE INDEX IF NOT EXISTS idx_episodes_created ON episodes(created_at DESC)',
];

/**
 * Ensure episodes table + indexes exist. Idempotent.
 * @param {import('better-sqlite3').Database} db
 */
function ensureEpisodesTable(db) {
  db.exec(SQL_EPISODES_CREATE);
  for (const idx of SQL_EPISODES_INDEXES) {
    db.exec(idx);
  }
}

/**
 * Check if episodes table exists in the database.
 * @param {import('better-sqlite3').Database} db
 * @returns {boolean}
 */
function hasEpisodesTable(db) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='episodes'").get();
  return row !== undefined;
}

/**
 * Generate a time-sortable episode ID.
 * Format: ep-{base36-timestamp}-{12-hex-random}
 */
function generateEpisodeId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `ep-${timestamp}-${random}`;
}

/**
 * Insert a bare episode from hook context (no LLM needed).
 * @param {import('better-sqlite3').Database} db
 * @param {object} entry
 * @returns {string} episode id
 */
function insertBareEpisode(db, entry) {
  const id = entry.id || generateEpisodeId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO episodes (id, kind, scope, project, summary, body, tags, entities, parent_id, status, supersedes, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    id,
    entry.kind || 'session',
    entry.scope || 'project',
    entry.project || null,
    entry.summary || '',
    entry.body || null,
    entry.tags || null,
    entry.entities ? JSON.stringify(entry.entities) : null,
    entry.parent_id || null,
    entry.supersedes || null,
    entry.source || 'hook',
    now,
  );

  return id;
}

/**
 * Query recent episodes for session-focus injection.
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts - { project, limit, maxChars }
 * @returns {Array<{kind: string, summary: string, created_at: string}>}
 */
function queryRecentEpisodes(db, opts) {
  const project = opts.project || null;
  const limit = opts.limit || 3;

  let sql = "SELECT kind, summary, created_at FROM episodes WHERE status = 'active'";
  const params = [];

  if (project) {
    sql += ' AND project = ?';
    params.push(project);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

/**
 * Query superseded episode chains for session-focus display.
 * CO-EVOLUTION: Uses episodes table schema from SQL_EPISODES_CREATE
 * @param {import('better-sqlite3').Database} db
 * @param {{ project: string, days?: number, limit?: number }} opts
 * @returns {Array<{current: string, previous: string, reason: string|null}>}
 */
function querySupersededChains(db, opts) {
  const days = opts.days ?? 7;
  const limit = opts.limit ?? 5;
  const modifier = `-${days} days`;
  const rows = db.prepare(`
    SELECT new_ep.summary AS current_summary, old_ep.summary AS previous_summary, new_ep.body
    FROM episodes new_ep
    JOIN episodes old_ep ON new_ep.supersedes = old_ep.id
    WHERE new_ep.project = ?
      AND new_ep.created_at > datetime('now', ?)
      AND old_ep.status = 'superseded'
    ORDER BY new_ep.created_at DESC
    LIMIT ?
  `).all(opts.project, modifier, limit);

  return rows.map(row => ({
    current: row.current_summary,
    previous: row.previous_summary,
    reason: parseReason(row.body),
  }));
}

/**
 * Parse ## Reason section from episode body.
 * @param {string|null} body
 * @returns {string|null}
 */
function parseReason(body) {
  if (!body) return null;
  const match = body.match(/## Reason\n(.+?)(?:\n##|\n*$)/s);
  if (!match) return null;
  return match[1].trim().split('\n')[0];
}

/**
 * Format superseded chains for session-focus inject.
 * @param {Array<{current: string, previous: string, reason: string|null}>} chains
 * @returns {string}
 */
function formatSupersededChains(chains) {
  if (chains.length === 0) return '';
  const lines = chains.map(c => {
    const base = `- ${c.current} \u2190 ${c.previous}`;
    return c.reason ? `${base} (Reason: ${c.reason})` : base;
  });
  return lines.join('\n');
}

/**
 * Query episodes across multiple sessions for enriched inject.
 * Excludes bare session episodes and nominations.
 * CO-EVOLUTION: Uses episodes table schema from SQL_EPISODES_CREATE
 * @param {import('better-sqlite3').Database} db
 * @param {{ project: string, days?: number, limit?: number }} opts
 */
function queryMultiSessionEpisodes(db, opts) {
  const days = opts.days ?? 3;
  const limit = opts.limit ?? 20;
  const modifier = `-${days} days`;
  return db.prepare(`
    SELECT kind, summary, created_at
    FROM episodes
    WHERE project = ?
      AND status = 'active'
      AND kind != 'session'
      AND kind != 'nomination'
      AND created_at > datetime('now', ?)
    ORDER BY created_at DESC
    LIMIT ?
  `).all(opts.project, modifier, limit);
}

/**
 * Format multi-session episodes for inject.
 * Groups by date. If too many per date, collapses to count-per-kind.
 * @param {Array<{kind: string, summary: string, created_at: string}>} episodes
 * @returns {string}
 */
function formatMultiSessionEpisodes(episodes) {
  if (episodes.length === 0) return '';

  const byDate = {};
  for (const ep of episodes) {
    const date = (ep.created_at || '').slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(ep);
  }

  const lines = [];
  let totalChars = 0;

  for (const [date, eps] of Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]))) {
    if (totalChars > MULTI_SESSION_TOKEN_CAP_CHARS) break;
    if (eps.length <= 5) {
      for (const ep of eps) {
        const line = `- [${date}] ${ep.kind}: ${String(ep.summary).slice(0, 100)}`;
        totalChars += line.length;
        if (totalChars > MULTI_SESSION_TOKEN_CAP_CHARS) break;
        lines.push(line);
      }
    } else {
      const kindCounts = {};
      for (const ep of eps) {
        kindCounts[ep.kind] = (kindCounts[ep.kind] || 0) + 1;
      }
      const counts = Object.entries(kindCounts).map(([k, c]) => `${c} ${k}`).join(', ');
      lines.push(`- [${date}] ${counts}`);
    }
  }

  return lines.join('\n');
}

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
  getProjectName,
  DEFAULT_MODELS,
  // Episodes (v0.4.1)
  EPISODE_KINDS_CJS,
  EPISODE_STATUSES_CJS,
  SQL_EPISODES_CREATE,
  SQL_EPISODES_INDEXES,
  ensureEpisodesTable,
  hasEpisodesTable,
  generateEpisodeId,
  insertBareEpisode,
  queryRecentEpisodes,
  querySupersededChains,
  formatSupersededChains,
  queryMultiSessionEpisodes,
  formatMultiSessionEpisodes,
};
