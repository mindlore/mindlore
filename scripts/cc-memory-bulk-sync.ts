#!/usr/bin/env node

/**
 * cc-memory-bulk-sync — One-shot sync of Claude Code memory files into Mindlore FTS5.
 *
 * Discovers ~/.claude/projects/*\/memory\/*.md, copies to .mindlore/memory/, and
 * indexes with category='cc-memory'. Idempotent via SHA256 content-hash.
 *
 * Usage: node dist/scripts/cc-memory-bulk-sync.js [--claude-dir <path>] [--db <path>] [--mindlore-dir <path>]
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  DB_NAME,
  GLOBAL_MINDLORE_DIR,
  CC_MEMORY_CATEGORY,
  resolveHookCommon,
} from './lib/constants.js';
import { CommonModuleWithFrontmatter, UPSERT_HASH_SQL, getArg } from './lib/sync-helpers.js';

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

// ── Discovery ─────────────────────────────────────────────────────────

/**
 * Discover CC memory files under {claudeDir}/projects\/*\/memory\/*.md.
 * Skips MEMORY.md (index files).
 */
export function discoverCcMemoryFiles(claudeDir: string): string[] {
  const projectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const results: string[] = [];

  let projectEntries: fs.Dirent[];
  try {
    projectEntries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch (_err) {
    return [];
  }

  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory()) continue;
    const memoryDir = path.join(projectsDir, projectEntry.name, 'memory');
    if (!fs.existsSync(memoryDir)) continue;

    let memoryEntries: fs.Dirent[];
    try {
      memoryEntries = fs.readdirSync(memoryDir, { withFileTypes: true });
    } catch (_err) {
      continue;
    }

    for (const memEntry of memoryEntries) {
      if (!memEntry.isFile()) continue;
      if (!memEntry.name.endsWith('.md')) continue;
      if (memEntry.name === 'MEMORY.md') continue;
      results.push(path.join(memoryDir, memEntry.name));
    }
  }

  return results;
}

// ── Safe prefix ───────────────────────────────────────────────────────

/**
 * Sanitize a CC project dir name for use as a filename prefix.
 * Strips path separators and dots sequences to prevent traversal.
 */
function safePrefix(dirName: string): string {
  return dirName
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[^\w\-. ]/g, '_')
    .slice(0, 80);
}

// ── Sync ──────────────────────────────────────────────────────────────

/**
 * Sync discovered CC memory files into Mindlore FTS5 DB.
 * Copies files to {mindloreDir}/memory/ with prefix {projectName}_.
 * Idempotent: skips files whose content hash already matches.
 */
export function syncToDb(
  dbPath: string,
  files: string[],
  mindloreDir: string,
): SyncResult {
  const result: SyncResult = { synced: 0, skipped: 0, errors: [] };

  if (files.length === 0) return result;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- resolveHookCommon validated at startup
  const common = require(resolveHookCommon(__dirname)) as CommonModuleWithFrontmatter;
  const { sha256, parseFrontmatter, extractFtsMetadata, insertFtsRow, openDatabase } = common;

  const db = openDatabase(dbPath);
  if (!db) {
    result.errors.push(`Cannot open DB at ${dbPath}`);
    return result;
  }

  // Ensure memory dest dir exists
  const memoryDestDir = path.join(mindloreDir, 'memory');
  fs.mkdirSync(memoryDestDir, { recursive: true });

  const getHash = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?');
  const upsertHash = db.prepare(UPSERT_HASH_SQL);
  const deleteFts = db.prepare('DELETE FROM mindlore_fts WHERE path = ?');

  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    for (const srcPath of files) {
      try {
        // Extract project name from grandparent dir of memory/
        // Structure: .../projects/{projectName}/memory/{file}.md
        const projectName = safePrefix(
          path.basename(path.dirname(path.dirname(srcPath))),
        );
        const destFileName = `${projectName}_${path.basename(srcPath)}`;
        const destPath = path.join(memoryDestDir, destFileName);

        const content = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n');
        const hash = sha256(content);

        // Idempotency check: use dest path as the canonical key
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- get() returns unknown
        const existing = getHash.get(destPath) as { content_hash: string } | undefined;
        if (existing && existing.content_hash === hash) {
          result.skipped++;
          continue;
        }

        const { meta, body } = parseFrontmatter(content);
        const ftsFields = extractFtsMetadata(meta, body, destPath, mindloreDir);

        // Override category — extractFtsMetadata would return 'memory', we need 'cc-memory'
        deleteFts.run(destPath);
        insertFtsRow(db, {
          path: destPath,
          slug: ftsFields.slug,
          description: ftsFields.description,
          type: ftsFields.type,
          category: CC_MEMORY_CATEGORY,
          title: ftsFields.title,
          content: body,
          tags: ftsFields.tags,
          quality: ftsFields.quality,
          dateCaptured: ftsFields.dateCaptured,
          project: projectName,
        });

        // Copy file before DB write — if copy fails, DB stays clean
        fs.copyFileSync(srcPath, destPath);

        upsertHash.run(destPath, hash, now, CC_MEMORY_CATEGORY);

        result.synced++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${path.basename(srcPath)}: ${msg}`);
      }
    }
  });

  transaction();
  db.close();

  return result;
}

// ── CLI ───────────────────────────────────────────────────────────────

const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) {
  const args = process.argv.slice(2);
  const claudeDir = getArg(args, '--claude-dir') ?? path.join(os.homedir(), '.claude');
  const mindloreDir = getArg(args, '--mindlore-dir') ?? GLOBAL_MINDLORE_DIR;
  const dbPath = getArg(args, '--db') ?? path.join(mindloreDir, DB_NAME);

  const files = discoverCcMemoryFiles(claudeDir);
  console.log(`  Discovered ${files.length} CC memory file(s)`);

  const result = syncToDb(dbPath, files, mindloreDir);

  console.log(`  Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.error(`  ERROR: ${e}`);
    }
    process.exit(1);
  }
}
