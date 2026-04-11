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
  return { slug, description, type, category, title };
}

/**
 * Shared SQL constants to prevent drift across indexing paths.
 */
const SQL_FTS_INSERT =
  'INSERT INTO mindlore_fts (path, slug, description, type, category, title, content) VALUES (?, ?, ?, ?, ?, ?, ?)';

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

module.exports = {
  MINDLORE_DIR,
  DB_NAME,
  SKIP_FILES,
  findMindloreDir,
  getLatestDelta,
  sha256,
  parseFrontmatter,
  extractFtsMetadata,
  SQL_FTS_INSERT,
  extractHeadings,
  requireDatabase,
  openDatabase,
  getAllMdFiles,
};
