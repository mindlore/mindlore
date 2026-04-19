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
import { runBackfill } from '../scripts/lib/backfill.js';

function createBackfillTestDb(dbPath: string): Database.Database {
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-backfill-'));
  db = createBackfillTestDb(path.join(tmpDir, 'test.db'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function insertRow(overrides: Partial<{
  p: string; hash: string; last: string; created: string | null;
  importance: number; project: string | null;
}> = {}): void {
  const p = overrides.p ?? '/test/file.md';
  const hash = overrides.hash ?? 'abc123';
  const last = overrides.last ?? '2026-01-01T00:00:00Z';
  const created = overrides.created ?? null;
  const importance = overrides.importance ?? 1.0;
  const project = overrides.project ?? null;
  db.prepare(
    'INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, importance, project_scope) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(p, hash, last, created, importance, project);
}

describe('runBackfill', () => {
  test('should populate created_at from last_indexed for NULL rows', () => {
    insertRow({ p: '/a.md', last: '2026-03-15T10:00:00Z', created: null });
    const result = runBackfill(db, tmpDir);
    expect(result.createdAtFixed).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare('SELECT created_at FROM file_hashes WHERE path = ?').get('/a.md') as { created_at: string };
    expect(row.created_at).toBe('2026-03-15T10:00:00Z');
  });

  test('should not overwrite existing created_at values', () => {
    insertRow({ p: '/b.md', last: '2026-03-15T10:00:00Z', created: '2026-01-01T00:00:00Z' });
    const result = runBackfill(db, tmpDir);
    expect(result.createdAtFixed).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare('SELECT created_at FROM file_hashes WHERE path = ?').get('/b.md') as { created_at: string };
    expect(row.created_at).toBe('2026-01-01T00:00:00Z');
  });

  test('should map importance from frontmatter quality', () => {
    const mdPath = path.join(tmpDir, 'quality.md');
    fs.writeFileSync(mdPath, '---\nquality: medium\n---\nContent here');
    insertRow({ p: mdPath, importance: 1.0 });
    const result = runBackfill(db, tmpDir);
    expect(result.importanceMapped).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(mdPath) as { importance: number };
    expect(row.importance).toBe(0.6);
  });

  test('should set importance to 0.5 when file has no quality frontmatter', () => {
    const mdPath = path.join(tmpDir, 'noquality.md');
    fs.writeFileSync(mdPath, '---\ntitle: Test\n---\nContent');
    insertRow({ p: mdPath, importance: 1.0 });
    const result = runBackfill(db, tmpDir);
    expect(result.importanceMapped).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(mdPath) as { importance: number };
    expect(row.importance).toBe(0.5);
  });

  test('should set project_scope for NULL rows', () => {
    insertRow({ p: '/c.md', project: null });
    const result = runBackfill(db, tmpDir);
    expect(result.projectScopeSet).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare('SELECT project_scope FROM file_hashes WHERE path = ?').get('/c.md') as { project_scope: string };
    expect(row.project_scope).toBe(path.basename(tmpDir));
  });

  test('should not overwrite existing project_scope', () => {
    insertRow({ p: '/d.md', project: 'my-project' });
    const result = runBackfill(db, tmpDir);
    expect(result.projectScopeSet).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare('SELECT project_scope FROM file_hashes WHERE path = ?').get('/d.md') as { project_scope: string };
    expect(row.project_scope).toBe('my-project');
  });

  test('should return correct counts', () => {
    insertRow({ p: '/e1.md', created: null, project: null });
    insertRow({ p: '/e2.md', created: '2026-01-01T00:00:00Z', project: 'existing' });
    insertRow({ p: '/e3.md', created: null, project: null });
    const result = runBackfill(db, tmpDir);
    expect(result.totalRows).toBe(3);
    expect(result.createdAtFixed).toBe(2);
    expect(result.projectScopeSet).toBe(2);
  });

  test('should skip importance mapping for non-existent files', () => {
    insertRow({ p: '/nonexistent/file.md', importance: 1.0 });
    const result = runBackfill(db, tmpDir);
    expect(result.importanceMapped).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get('/nonexistent/file.md') as { importance: number };
    expect(row.importance).toBe(1.0);
  });

  test('should not remap importance when quality is high (already 1.0)', () => {
    const mdPath = path.join(tmpDir, 'highq.md');
    fs.writeFileSync(mdPath, '---\nquality: high\n---\nContent');
    insertRow({ p: mdPath, importance: 1.0 });
    const result = runBackfill(db, tmpDir);
    expect(result.importanceMapped).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(mdPath) as { importance: number };
    expect(row.importance).toBe(1.0);
  });
});
