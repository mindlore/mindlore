#!/usr/bin/env node

/**
 * mindlore-fts5-index — Full re-index of .mindlore/ into FTS5 database.
 *
 * Scans all .md files, computes SHA256 content-hash, skips unchanged files.
 * v0.5.0: --embed flag generates vector embeddings into documents_vec table.
 * Usage: node dist/scripts/mindlore-fts5-index.js [path-to-mindlore-dir] [--embed]
 */

import fs from 'fs';
import path from 'path';
import { DB_NAME, GLOBAL_MINDLORE_DIR, resolveHookCommon } from './lib/constants.js';
import { dbAll, loadSqliteVec, ensureVecTable } from './lib/db-helpers.js';
import { ensureSchemaTable, runMigrations } from './lib/schema-version.js';
import { V050_MIGRATIONS } from './lib/migrations.js';
import { generateEmbedding, EMBEDDING_MODEL } from './lib/embedding.js';

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
  };
  insertFtsRow: (db: import('better-sqlite3').Database, entry: {
    path: string; slug?: string; description?: string; type?: string;
    category?: string; title?: string; content?: string; tags?: string;
    quality?: string | null; dateCaptured?: string | null; project?: string | null;
  }) => void;
} = require(resolveHookCommon(__dirname));
const { sha256, getAllMdFiles, openDatabase, parseFrontmatter, extractFtsMetadata, insertFtsRow } = common;

// ── Types ─────────────────────────────────────────────────────────────

interface FileToEmbed {
  slug: string;
  text: string;
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
  runMigrations(db, V050_MIGRATIONS);

  // Load sqlite-vec if available
  const vecAvailable = loadSqliteVec(db);
  if (vecAvailable) {
    ensureVecTable(db);
  }

  const embedFlag = process.argv.includes('--embed');
  const shouldEmbed = embedFlag && vecAvailable;

  const upsertHash = db.prepare(`
    INSERT INTO file_hashes (path, content_hash, last_indexed)
    VALUES (?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      last_indexed = excluded.last_indexed
  `);
  const deleteFts = db.prepare('DELETE FROM mindlore_fts WHERE path = ?');
  const getHash = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?');

  const mdFiles = getAllMdFiles(baseDir);
  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date().toISOString();
  const project = path.basename(process.cwd());

  // Collect files that need embedding (processed after FTS5 transaction)
  const toEmbed: FileToEmbed[] = [];

  // Phase 1: FTS5 indexing (synchronous transaction)
  const transaction = db.transaction(() => {
    for (const filePath of mdFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
        const hash = sha256(content);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pre-prepared stmt in hot loop
        const existing = getHash.get(filePath) as { content_hash: string } | undefined;
        if (existing && existing.content_hash === hash) {
          skipped++;
          continue;
        }

        const { meta, body } = parseFrontmatter(content);
        const { slug, description, type, category, title, tags, quality, dateCaptured } =
          extractFtsMetadata(meta, body, filePath, baseDir);
        deleteFts.run(filePath);
        insertFtsRow(db, { path: filePath, slug, description, type, category, title, content: body, tags, quality, dateCaptured, project });

        upsertHash.run(filePath, hash, now);
        indexed++;

        // Queue for embedding
        if (shouldEmbed) {
          const textToEmbed = `${title || slug}: ${description || ''} ${body.slice(0, 500)}`;
          toEmbed.push({ slug, text: textToEmbed });
        }
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
        deleteHash.run(row.path);
        removed++;
      }
    }
  });

  cleanupTransaction();

  console.log(
    `\n  FTS5 Index: ${indexed} indexed, ${skipped} unchanged, ${removed} removed, ${errors} errors`,
  );

  // Phase 2: Embedding (async, outside transaction)
  if (shouldEmbed && toEmbed.length > 0) {
    let embedded = 0;
    let embedErrors = 0;

    const upsertVec = db.prepare(`
      INSERT OR REPLACE INTO documents_vec (embedding, slug, created_at, model_name)
      VALUES (?, ?, ?, ?)
    `);

    for (const item of toEmbed) {
      try {
        const embedding = await generateEmbedding(item.text);
        const buf = Buffer.from(new Float32Array(embedding).buffer);
        upsertVec.run(buf, item.slug, now, EMBEDDING_MODEL);
        embedded++;
      } catch (embedErr) {
        const msg = embedErr instanceof Error ? embedErr.message : String(embedErr);
        console.error(`  Embed error ${item.slug}: ${msg}`);
        embedErrors++;
      }
    }

    console.log(`  Vec Index: ${embedded} embedded, ${embedErrors} errors`);
  }

  db.close();
  console.log('');
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
