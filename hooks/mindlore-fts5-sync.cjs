#!/usr/bin/env node
'use strict';

/**
 * mindlore-fts5-sync — FileChanged hook (incremental re-index)
 *
 * Handles bulk file changes by checking all .mindlore/ .md files
 * against their content hashes and re-indexing only changed ones.
 *
 * Lightweight complement to mindlore-index.cjs which handles single files.
 * This hook catches cases where multiple files change at once (e.g., git pull).
 */

const fs = require('fs');
const path = require('path');
const { DB_NAME, sha256, openDatabase, getAllMdFiles, parseFrontmatter, extractFtsMetadata, insertFtsRow, readHookStdin, getActiveMindloreDir, getProjectName, resolveProject, hookLog, withTelemetry, SQL_FTS_SESSIONS_INSERT, isSessionCategory, isInsideMindloreDir } = require('./lib/mindlore-common.cjs');

function main() {
  const filePath = readHookStdin(['path', 'file_path']);

  if (!filePath) return;
  const resolved = path.resolve(filePath);
  if (!isInsideMindloreDir(resolved)) return;

  // Skip if this is a single .md file change — mindlore-index.cjs handles those.
  // This hook is for bulk changes (git pull, manual batch edits).
  if (filePath.endsWith('.md')) return;

  const baseDir = getActiveMindloreDir();
  if (!fs.existsSync(baseDir)) return;

  const dbPath = path.join(baseDir, DB_NAME);
  if (!fs.existsSync(dbPath)) return;

  const db = openDatabase(dbPath);
  if (!db) return;

  const mdFiles = getAllMdFiles(baseDir);


  const getHash = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?');
  const deleteFts = db.prepare('DELETE FROM mindlore_fts WHERE path = ?');
  const deleteFtsSessions = db.prepare('DELETE FROM mindlore_fts_sessions WHERE path = ?');
  const insertFtsSessions = db.prepare(SQL_FTS_SESSIONS_INSERT);
  const upsertHash = db.prepare(`
    INSERT INTO file_hashes (path, content_hash, last_indexed)
    VALUES (?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      last_indexed = excluded.last_indexed
  `);

  const now = new Date().toISOString();

  try {
    const project = getProjectName();

    // Pre-read all files outside the DB transaction to avoid holding
    // the write lock during slow file I/O (R4 root cause fix).
    const changedFiles = [];
    for (const file of mdFiles) {
      const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      const hash = sha256(content);

      const existing = getHash.get(file);
      if (existing && existing.content_hash === hash) continue;

      const { meta, body } = parseFrontmatter(content);
      const { slug, description, type, category, title, tags, quality, dateCaptured, project: ftsProject } = extractFtsMetadata(meta, body, file, baseDir);
      const resolvedProject = resolveProject(ftsProject, file, project);
      changedFiles.push({ file, hash, slug, description, type, category, title, tags, quality, dateCaptured, resolvedProject, body });
    }

    // DB transaction: only DB writes — no file I/O inside to minimize lock hold time
    const transaction = db.transaction(() => {
      for (const item of changedFiles) {
        deleteFts.run(item.file);
        deleteFtsSessions.run(item.file);
        if (isSessionCategory(item.category)) {
          insertFtsSessions.run(item.file, item.slug, item.description, item.type, item.category, item.title, item.body, item.tags, item.quality ?? null, item.dateCaptured ?? null, item.resolvedProject);
        } else {
          insertFtsRow(db, { path: item.file, slug: item.slug, description: item.description, type: item.type, category: item.category, title: item.title, content: item.body, tags: item.tags, quality: item.quality, dateCaptured: item.dateCaptured, project: item.resolvedProject });
        }
        upsertHash.run(item.file, item.hash, now);
      }
    });
    transaction();
  } finally {
    db.close();
  }

}

withTelemetry('mindlore-fts5-sync', main).catch(err => {
  hookLog('mindlore-fts5-sync', 'error', err?.message ?? String(err));
  process.exit(0);
});
