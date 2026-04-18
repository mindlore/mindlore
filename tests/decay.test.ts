import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { createTestDb } from './helpers/db.js';
import { ensureSchemaTable, runMigrations } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V051_MIGRATIONS } from '../scripts/lib/migrations-v051.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';
import {
  calculateDecayScore,
  archiveDocument,
  restoreDocument,
  listStaleDocuments,
} from '../scripts/lib/decay.js';

function createDecayTestDb(dbPath: string): Database.Database {
  const db = createTestDb(dbPath);
  ensureSchemaTable(db);
  runMigrations(db, [
    ...V050_MIGRATIONS,
    ...V051_MIGRATIONS,
    ...V052_MIGRATIONS,
    ...V053_MIGRATIONS,
  ]);
  return db;
}

let tmpDir: string;
let db: Database.Database;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-decay-'));
  db = createDecayTestDb(path.join(tmpDir, 'test.db'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('calculateDecayScore', () => {
  test('returns >0.8 for recently accessed doc with high recall', () => {
    const score = calculateDecayScore({
      created_at: new Date().toISOString(),
      last_recalled_at: new Date().toISOString(),
      recall_count: 20,
      importance: 1.0,
    });
    expect(score).toBeGreaterThan(0.8);
  });

  test('returns <0.3 for 90-day old unaccessed doc', () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const score = calculateDecayScore({
      created_at: ninetyDaysAgo,
      last_recalled_at: null,
      recall_count: 0,
      importance: 1.0,
    });
    expect(score).toBeLessThan(0.3);
  });
});

describe('archiveDocument / restoreDocument', () => {
  test('archiveDocument sets archived_at, restoreDocument clears it', () => {
    db.prepare(
      `INSERT INTO file_hashes (path, content_hash, last_indexed, recall_count, last_recalled_at, importance)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('/test/doc.md', 'abc123', new Date().toISOString(), 0, null, 1.0);

    archiveDocument(db, '/test/doc.md');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const afterArchive = db.prepare(
      'SELECT archived_at FROM file_hashes WHERE path = ?'
    ).get('/test/doc.md') as { archived_at: string | null };
    expect(afterArchive.archived_at).not.toBeNull();

    restoreDocument(db, '/test/doc.md');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const afterRestore = db.prepare(
      'SELECT archived_at FROM file_hashes WHERE path = ?'
    ).get('/test/doc.md') as { archived_at: string | null };
    expect(afterRestore.archived_at).toBeNull();
  });
});

describe('listStaleDocuments', () => {
  test('returns docs below threshold and excludes active ones', () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Stale: old, never recalled
    db.prepare(
      `INSERT INTO file_hashes (path, content_hash, last_indexed, recall_count, last_recalled_at, importance)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('/test/stale.md', 'hash1', ninetyDaysAgo, 0, null, 1.0);

    // Active: recently recalled with high recall_count
    db.prepare(
      `INSERT INTO file_hashes (path, content_hash, last_indexed, recall_count, last_recalled_at, importance)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('/test/active.md', 'hash2', now, 20, now, 1.0);

    const stale = listStaleDocuments(db, 0.3);

    const paths = stale.map(d => d.path);
    expect(paths).toContain('/test/stale.md');
    expect(paths).not.toContain('/test/active.md');

    // Results sorted by decay_score ascending
    if (stale.length > 1) {
      expect(stale[0]!.decay_score).toBeLessThanOrEqual(stale[stale.length - 1]!.decay_score);
    }
  });
});
