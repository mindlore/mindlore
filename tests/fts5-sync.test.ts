import path from 'path';
import fs from 'fs';
import { createTestDb, setupTestDir, teardownTestDir } from './helpers/db.js';

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-fts5-sync');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');
const SOURCES_DIR = path.join(TEST_DIR, 'sources');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources', 'raw']);
  const db = createTestDb(DB_PATH);
  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('FTS5 Incremental Sync', () => {
  test('should index a new file incrementally', () => {
    const Database = require('better-sqlite3');
    const { sha256, parseFrontmatter, extractFtsMetadata, insertFtsRow } = require('../hooks/lib/mindlore-common.cjs');
    const db = new Database(DB_PATH);

    const filePath = path.join(SOURCES_DIR, 'new-doc.md');
    const content = '---\nslug: new-doc\ntype: source\ntitle: New Doc\ntags: [test]\nquality: medium\ndate_captured: 2026-04-12\n---\n\n# New Doc\n\nIncremental sync test content.';
    fs.writeFileSync(filePath, content);

    // Simulate what fts5-sync hook does: parse frontmatter + extract metadata + insert
    const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    const hash = sha256(raw);
    const { meta: fm, body } = parseFrontmatter(raw);
    const meta = extractFtsMetadata(fm, body, filePath, TEST_DIR);

    insertFtsRow(db, {
      path: filePath,
      slug: meta.slug,
      description: meta.description,
      type: meta.type,
      category: meta.category,
      title: meta.title,
      content: meta.content,
      tags: meta.tags,
      quality: meta.quality,
      dateCaptured: meta.dateCaptured,
    });

    // Update file hash
    db.prepare(`INSERT OR REPLACE INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, datetime('now'))`).run(filePath, hash);

    // Verify indexed
    const result = db.prepare('SELECT count(*) as cnt FROM mindlore_fts WHERE path = ?').get(filePath) as { cnt: number };
    expect(result.cnt).toBe(1);

    // Verify hash stored
    const hashRow = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?').get(filePath) as { content_hash: string };
    expect(hashRow.content_hash).toBe(hash);

    db.close();
  });

  test('should skip unchanged files (same hash)', () => {
    const Database = require('better-sqlite3');
    const { sha256, parseFrontmatter, extractFtsMetadata, insertFtsRow } = require('../hooks/lib/mindlore-common.cjs');
    const db = new Database(DB_PATH);

    const filePath = path.join(SOURCES_DIR, 'unchanged.md');
    const content = '---\nslug: unchanged\ntype: source\ntitle: Unchanged\ntags: []\nquality: low\n---\n\n# Unchanged\n\nThis will not change.';
    fs.writeFileSync(filePath, content);

    const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    const hash = sha256(raw);
    const { meta: fm, body } = parseFrontmatter(raw);
    const meta = extractFtsMetadata(fm, body, filePath, TEST_DIR);

    // First insert
    insertFtsRow(db, {
      path: filePath,
      slug: meta.slug,
      description: meta.description,
      type: meta.type,
      category: meta.category,
      title: meta.title,
      content: meta.content,
      tags: meta.tags,
      quality: meta.quality,
      dateCaptured: meta.dateCaptured,
    });
    db.prepare(`INSERT OR REPLACE INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, datetime('now'))`).run(filePath, hash);

    // Re-read same file — hash should match, skip re-index
    const raw2 = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    const hash2 = sha256(raw2);
    const existingHash = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?').get(filePath) as { content_hash: string } | undefined;

    expect(existingHash).toBeDefined();
    expect(hash2).toBe(existingHash!.content_hash);

    db.close();
  });

  test('should re-index when file content changes', () => {
    const Database = require('better-sqlite3');
    const { sha256, parseFrontmatter, extractFtsMetadata, insertFtsRow } = require('../hooks/lib/mindlore-common.cjs');
    const db = new Database(DB_PATH);

    const filePath = path.join(SOURCES_DIR, 'changing.md');
    const content1 = '---\nslug: changing\ntype: source\ntitle: Version 1\ntags: [v1]\nquality: low\n---\n\n# Version 1\n\nOriginal content.';
    fs.writeFileSync(filePath, content1);

    const raw1 = content1.replace(/\r\n/g, '\n');
    const hash1 = sha256(raw1);
    const { meta: fm1, body: body1 } = parseFrontmatter(raw1);
    const meta1 = extractFtsMetadata(fm1, body1, filePath, TEST_DIR);
    insertFtsRow(db, { path: filePath, slug: meta1.slug, description: meta1.description, type: meta1.type, category: meta1.category, title: meta1.title, content: meta1.content, tags: meta1.tags, quality: meta1.quality, dateCaptured: meta1.dateCaptured });
    db.prepare(`INSERT OR REPLACE INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, datetime('now'))`).run(filePath, hash1);

    // Change file
    const content2 = '---\nslug: changing\ntype: source\ntitle: Version 2\ntags: [v2]\nquality: high\n---\n\n# Version 2\n\nUpdated content with new info.';
    fs.writeFileSync(filePath, content2);

    const raw2 = content2.replace(/\r\n/g, '\n');
    const hash2 = sha256(raw2);

    // Hash should differ
    expect(hash2).not.toBe(hash1);

    // Re-index: delete old + insert new
    db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
    const { meta: fm2, body: body2 } = parseFrontmatter(raw2);
    const meta2 = extractFtsMetadata(fm2, body2, filePath, TEST_DIR);
    insertFtsRow(db, { path: filePath, slug: meta2.slug, description: meta2.description, type: meta2.type, category: meta2.category, title: meta2.title, content: meta2.content, tags: meta2.tags, quality: meta2.quality, dateCaptured: meta2.dateCaptured });
    db.prepare(`INSERT OR REPLACE INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, datetime('now'))`).run(filePath, hash2);

    // Verify updated
    const row = db.prepare('SELECT title FROM mindlore_fts WHERE path = ?').get(filePath) as { title: string };
    expect(row.title).toBe('Version 2');

    db.close();
  });
});
