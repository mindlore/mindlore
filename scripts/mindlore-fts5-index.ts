#!/usr/bin/env node

/**
 * mindlore-fts5-index — Full re-index of .mindlore/ into FTS5 database.
 *
 * Scans all .md files, computes SHA256 content-hash, skips unchanged files.
 * Usage: node dist/scripts/mindlore-fts5-index.js [path-to-mindlore-dir]
 */

import fs from 'fs';
import path from 'path';
import { DB_NAME, GLOBAL_MINDLORE_DIR, resolveHookCommon, isSessionCategory } from './lib/constants.js';
import { dbAll } from './lib/db-helpers.js';
import { ensureSchemaTable, runMigrations } from './lib/schema-version.js';
import { FTS_DB_MIGRATIONS } from './lib/all-migrations.js';
import { populateVocabulary } from './lib/fuzzy.js';
import { chunkMarkdown } from './lib/chunker.js';

const common: {
  sha256: (content: string) => string;
  getAllMdFiles: (dir: string) => string[];
  openDatabase: (dbPath: string) => import('better-sqlite3').Database | null;
  parseFrontmatter: (content: string) => { meta: Record<string, string>; body: string };
  extractFtsMetadata: (
    meta: Record<string, string>,
    body: string,
    filePath: string,
    baseDir: string,
  ) => {
    slug: string;
    description: string;
    type: string;
    category: string;
    title: string;
    tags: string;
    quality: string | null;
    dateCaptured: string | null;
    project: string | null;
  };
  insertFtsRow: (db: import('better-sqlite3').Database, entry: {
    path: string; slug?: string; description?: string; type?: string;
    category?: string; title?: string; content?: string; tags?: string;
    quality?: string | null; dateCaptured?: string | null; project?: string | null;
  }) => void;
  resolveProject: (ftsProject: string | null, filePath: string, cwdFallback: string) => string;
} = require(resolveHookCommon(__dirname));
const { sha256, getAllMdFiles, openDatabase, parseFrontmatter, extractFtsMetadata, insertFtsRow, resolveProject } = common;

// ── Helpers ──────────────────────────────────────────────────────────

function qualityToImportance(quality: string | undefined | null): number {
  switch (quality) {
    case 'high': return 1.0;
    case 'medium': return 0.6;
    case 'low': return 0.3;
    default: return 0.5;
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const baseDir = process.argv[2] && !process.argv[2].startsWith('--')
    ? process.argv[2]
    : GLOBAL_MINDLORE_DIR;
  const dbPath = path.join(baseDir, DB_NAME);

  if (!fs.existsSync(dbPath)) {
    console.error('  Database not found. Run: npx mindlore init');
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  if (!db) {
    console.error('  better-sqlite3 not installed. Run: npm install better-sqlite3');
    process.exit(1);
  }

  // Run schema migrations
  ensureSchemaTable(db);
  runMigrations(db, FTS_DB_MIGRATIONS);

  const projectName = path.basename(process.cwd());
  const upsertHash = db.prepare(`
    INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
    VALUES (?, ?, ?, datetime('now'), ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      last_indexed = excluded.last_indexed,
      updated_at = datetime('now'),
      project_scope = excluded.project_scope,
      importance = excluded.importance
  `);
  const deleteFts = db.prepare('DELETE FROM mindlore_fts WHERE path = ?');
  const deleteFtsSessions = db.prepare('DELETE FROM mindlore_fts_sessions WHERE path = ?');
  const insertFtsSessions = db.prepare(
    `INSERT INTO mindlore_fts_sessions (path, slug, description, type, category, title, content, tags, quality, date_captured, project)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const getHash = db.prepare('SELECT content_hash, last_indexed FROM file_hashes WHERE path = ?');
  const checkFts = db.prepare('SELECT 1 FROM mindlore_fts WHERE path = ? LIMIT 1');
  const checkFtsSessions = db.prepare('SELECT 1 FROM mindlore_fts_sessions WHERE path = ? LIMIT 1');

  let hasChunksTable = false;
  try {
    db.prepare("SELECT 1 FROM chunks LIMIT 0").run();
    hasChunksTable = true;
  } catch (_) { /* chunks table not yet created */ }
  const deleteChunks = hasChunksTable ? db.prepare('DELETE FROM chunks WHERE source_path = ?') : null;
  const insertChunk = hasChunksTable ? db.prepare(
    'INSERT OR REPLACE INTO chunks (source_path, chunk_index, heading, breadcrumb, char_count) VALUES (?, ?, ?, ?, ?)'
  ) : null;

  const mdFiles = getAllMdFiles(baseDir);
  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date().toISOString();

  // Phase 1: FTS5 indexing (synchronous transaction)
  const transaction = db.transaction(() => {
    for (const filePath of mdFiles) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pre-prepared stmt in hot loop
        const existing = getHash.get(filePath) as { content_hash: string; last_indexed: string } | undefined;

        // mtime gate: skip hash computation if file hasn't been modified since last index
        if (existing) {
          const fileMtime = fs.statSync(filePath).mtimeMs;
          const indexedAt = new Date(existing.last_indexed).getTime();
          if (fileMtime <= indexedAt) {
            const ftsExists = checkFts.get(filePath) || checkFtsSessions.get(filePath);
            if (ftsExists) {
              skipped++;
              continue;
            }
          }
        }

        const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
        const hash = sha256(content);

        if (existing && existing.content_hash === hash) {
          // Verify FTS5 entry exists — file_hashes and mindlore_fts can get out of sync
          const ftsExists = checkFts.get(filePath) || checkFtsSessions.get(filePath);
          if (ftsExists) {
            skipped++;
            continue;
          }
          // FTS5 missing — fall through to re-index
        }

        const { meta, body } = parseFrontmatter(content);
        const { slug, description, type, category, title, tags, quality, dateCaptured, project: ftsProject } =
          extractFtsMetadata(meta, body, filePath, baseDir);
        const resolvedProject = resolveProject(ftsProject, filePath, projectName);
        deleteFts.run(filePath);
        deleteFtsSessions.run(filePath);
        if (isSessionCategory(category)) {
          insertFtsSessions.run(filePath, slug, description, type, category, title, body, tags, quality ?? null, dateCaptured ?? null, resolvedProject);
        } else {
          insertFtsRow(db, { path: filePath, slug, description, type, category, title, content: body, tags, quality, dateCaptured, project: resolvedProject });
        }

        try { populateVocabulary(db, body); } catch (_) { /* vocabulary table may not exist in older DBs */ }

        if (deleteChunks && insertChunk) {
          deleteChunks.run(filePath);
          const fileChunks = chunkMarkdown(body);
          for (const chunk of fileChunks) {
            insertChunk.run(filePath, chunk.index, chunk.heading, chunk.breadcrumb, chunk.charCount);
          }
        }
        upsertHash.run(filePath, hash, now, projectName, qualityToImportance(quality));
        indexed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  Error indexing ${path.basename(filePath)}: ${message}`);
        errors++;
      }
    }
  });

  transaction();

  // Cleanup stale entries
  const allIndexed = dbAll<{ path: string }>(db, 'SELECT path FROM file_hashes');
  const existingPaths = new Set(mdFiles);
  let removed = 0;

  const deleteHash = db.prepare('DELETE FROM file_hashes WHERE path = ?');
  const cleanupTransaction = db.transaction(() => {
    for (const row of allIndexed) {
      if (!existingPaths.has(row.path)) {
        deleteFts.run(row.path);
        deleteFtsSessions.run(row.path);
        deleteHash.run(row.path);
        removed++;
      }
    }
  });

  cleanupTransaction();

  // FTS5 segment optimization after full re-index
  if (indexed > 0) {
    db.exec("INSERT INTO mindlore_fts(mindlore_fts) VALUES('optimize')");
    try {
      db.exec("INSERT INTO mindlore_fts_trigram(mindlore_fts_trigram) VALUES('optimize')");
    } catch (_err) { /* trigram table may not exist */ }
  }

  console.log(
    `\n  FTS5 Index: ${indexed} indexed, ${skipped} unchanged, ${removed} removed, ${errors} errors`,
  );

  db.close();
  console.log('');
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
