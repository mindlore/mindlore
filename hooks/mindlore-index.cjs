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
const { MINDLORE_DIR, DB_NAME, SKIP_FILES, sha256, openDatabase, parseFrontmatter, extractFtsMetadata, insertFtsRow, readHookStdin, getProjectName, globalDir } = require('./lib/mindlore-common.cjs');

function main() {
  const filePath = readHookStdin(['path', 'file_path']);
  if (!filePath) return;

  // Only process .md files inside .mindlore/ (resolved path check prevents traversal)
  if (!filePath.endsWith('.md')) return;
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.includes(path.sep + MINDLORE_DIR + path.sep) && !resolvedFile.includes(path.sep + MINDLORE_DIR)) {
    // CC memory path (~/.claude/projects/*/memory/*.md) — index to global mindlore DB
    const isCcMemory = resolvedFile.includes(path.sep + '.claude' + path.sep + 'projects' + path.sep)
      && resolvedFile.includes(path.sep + 'memory' + path.sep)
      && resolvedFile.endsWith('.md');
    if (!isCcMemory) return;

    // CC memory path — index to global mindlore DB
    indexCcMemory(resolvedFile);
    return;
  }

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

function indexCcMemory(filePath) {
  const CC_MEMORY_CATEGORY = 'cc-memory';
  // CC memory constants live in TS (scripts/lib/constants.ts) — CJS hooks can't require TS directly
  const globalBase = globalDir();
  const dbPath = path.join(globalBase, DB_NAME);

  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!content.trim()) return;

  // Privacy filter — redact secrets before DB write
  let cleaned = content;
  try {
    const { redactSecrets } = require('../dist/scripts/lib/privacy-filter.js');
    cleaned = redactSecrets(content);
  } catch (_err) {
    // privacy-filter not built — use raw content
  }

  // SHA256 dedup
  const hash = sha256(cleaned);
  const db = openDatabase(dbPath);
  if (!db) return;

  try {
    const existing = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?').get(filePath);
    if (existing && existing.content_hash === hash) {
      return; // unchanged — finally handles db.close()
    }

    const { meta, body } = parseFrontmatter(cleaned);
    const memType = String(meta.type || 'unknown');

    // Extract project scope from path: ~/.claude/projects/C--Users-X-proj/memory/
    const projMatch = filePath.match(/projects[/\\]([^/\\]+)[/\\]memory/);
    const projectScope = projMatch ? projMatch[1] : null;

    const ftsData = extractFtsMetadata(meta, body, filePath, globalBase);

    // Update FTS5 + hash atomically
    const updateIndex = db.transaction(() => {
      db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
      insertFtsRow(db, {
        path: filePath,
        ...ftsData,
        category: CC_MEMORY_CATEGORY,
        type: memType,
        project: projectScope,
      });
      db.prepare(
        `INSERT INTO file_hashes (path, content_hash, last_indexed, source_type, project_scope)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           content_hash = excluded.content_hash,
           last_indexed = excluded.last_indexed,
           source_type = excluded.source_type,
           project_scope = excluded.project_scope`
      ).run(filePath, hash, new Date().toISOString(), CC_MEMORY_CATEGORY, projectScope);
    });
    updateIndex();

    // Copy to ~/.mindlore/memory/{project}/ for git-sync + obsidian
    const memoryDir = path.join(globalBase, 'memory', projectScope || '_global');
    fs.mkdirSync(memoryDir, { recursive: true });
    const destPath = path.join(memoryDir, path.basename(filePath));
    fs.writeFileSync(destPath, cleaned, 'utf8');
  } finally {
    db.close();
  }
}

main();
