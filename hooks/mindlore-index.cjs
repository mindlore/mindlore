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
const { MINDLORE_DIR, DB_NAME, SKIP_FILES, sha256, openDatabase, parseFrontmatter, extractFtsMetadata, insertFtsRow, readHookStdin, getProjectName, resolveProject, globalDir, hookLog, withTelemetry } = require('./lib/mindlore-common.cjs');

function invalidateSearchCache(db) {
  try { db.exec('DELETE FROM search_cache'); } catch (_) { /* table may not exist */ }
}

function main() {
  const filePath = readHookStdin(['path', 'file_path']);
  if (!filePath) return;

  // Only process .md files inside .mindlore/ (resolved path check prevents traversal)
  if (!filePath.endsWith('.md')) return;
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.includes(path.sep + MINDLORE_DIR + path.sep) && !resolvedFile.endsWith(path.sep + MINDLORE_DIR)) {
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

  const sepDir = path.sep + MINDLORE_DIR;
  let mindloreIdx = resolvedFile.lastIndexOf(sepDir + path.sep);
  if (mindloreIdx === -1 && resolvedFile.endsWith(sepDir)) {
    mindloreIdx = resolvedFile.length - sepDir.length;
  }
  if (mindloreIdx === -1) return;
  const baseDir = resolvedFile.slice(0, mindloreIdx + sepDir.length);
  const dbPath = path.join(baseDir, DB_NAME);

  if (!fs.existsSync(dbPath)) return;

  // Catch-up scan: when INDEX.md or log.md triggers, index recently-modified files
  if (['INDEX.md', 'log.md'].includes(fileName)) {
    catchUpScan(baseDir, dbPath);
    return;
  }

  if (SKIP_FILES.has(fileName)) return;

  if (!fs.existsSync(filePath)) {
    // File was deleted — remove from index
    const db = openDatabase(dbPath);
    if (!db) return;
    try {
      db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
      db.prepare('DELETE FROM file_hashes WHERE path = ?').run(filePath);
      invalidateSearchCache(db);
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
    const { slug, description, type, category, title, tags, quality, dateCaptured, project: ftsProject } = extractFtsMetadata(meta, body, filePath, baseDir);

    // Update FTS5 + hash atomically
    const updateIndex = db.transaction(() => {
      db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
      insertFtsRow(db, { path: filePath, slug, description, type, category, title, content: body, tags, quality, dateCaptured, project: resolveProject(ftsProject, filePath, getProjectName()) });
      db.prepare(
        `INSERT INTO file_hashes (path, content_hash, last_indexed)
         VALUES (?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           content_hash = excluded.content_hash,
           last_indexed = excluded.last_indexed`
      ).run(filePath, hash, new Date().toISOString());
    });
    updateIndex();
    invalidateSearchCache(db);
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
    fs.mkdirSync(memoryDir, { recursive: true, mode: 0o700 });
    const destPath = path.join(memoryDir, path.basename(filePath));
    fs.writeFileSync(destPath, cleaned, { encoding: 'utf8', mode: 0o600 });
  } finally {
    db.close();
  }
}

function catchUpScan(baseDir, dbPath) {
  const CATCH_UP_DIRS = ['raw', 'sources', 'analyses', 'diary'];
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;

  const db = openDatabase(dbPath);
  if (!db) return;

  try {
    let indexed = 0;
    for (const dir of CATCH_UP_DIRS) {
      const dirPath = path.join(baseDir, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < fiveMinAgo) continue;

        const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
        const hash = sha256(content);

        const existing = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?').get(filePath);
        if (existing && existing.content_hash === hash) continue;

        const { meta, body } = parseFrontmatter(content);
        const ftsData = extractFtsMetadata(meta, body, filePath, baseDir);

        const update = db.transaction(() => {
          db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
          insertFtsRow(db, { path: filePath, ...ftsData, project: resolveProject(ftsData.project, filePath, getProjectName()) });
          db.prepare(
            `INSERT INTO file_hashes (path, content_hash, last_indexed)
             VALUES (?, ?, ?)
             ON CONFLICT(path) DO UPDATE SET
               content_hash = excluded.content_hash,
               last_indexed = excluded.last_indexed`
          ).run(filePath, hash, new Date().toISOString());
        });
        update();
        indexed++;
      }
    }
    if (indexed > 0) {
      hookLog(`catch-up: ${indexed} file(s) indexed`);
    }
  } finally {
    db.close();
  }
}

withTelemetry('mindlore-index', main).catch(err => {
  hookLog('mindlore-index', 'error', err?.message ?? String(err));
  process.exit(0);
});
