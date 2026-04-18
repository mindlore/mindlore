import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runMigrations, ensureSchemaTable } from '../scripts/lib/schema-version';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052';

describe('skill_memory table', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-skillmem-'));
    const dbPath = path.join(tmpDir, 'test.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    ensureSchemaTable(db);
    runMigrations(db, V052_MIGRATIONS);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates skill_memory table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='skill_memory'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('inserts and retrieves skill memory', () => {
    db.prepare(
      `INSERT INTO skill_memory (skill_name, key, value, updated_at)
       VALUES (?, ?, ?, ?)`
    ).run('mindlore-ingest', 'last_ingest_urls', '["https://example.com"]', new Date().toISOString());

    const row = db.prepare(
      'SELECT * FROM skill_memory WHERE skill_name = ? AND key = ?'
    ).get('mindlore-ingest', 'last_ingest_urls') as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.value).toBe('["https://example.com"]');
    expect(row.access_count).toBe(0);
  });

  it('enforces UNIQUE(skill_name, key) constraint', () => {
    const insert = db.prepare(
      `INSERT INTO skill_memory (skill_name, key, value, updated_at)
       VALUES (?, ?, ?, ?)`
    );
    insert.run('mindlore-query', 'log', '[]', new Date().toISOString());

    expect(() => {
      insert.run('mindlore-query', 'log', '["x"]', new Date().toISOString());
    }).toThrow();
  });

  it('upserts with ON CONFLICT', () => {
    const upsert = db.prepare(
      `INSERT INTO skill_memory (skill_name, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(skill_name, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at,
         access_count = access_count + 1`
    );
    const now = new Date().toISOString();
    upsert.run('mindlore-diary', 'last_date', '"2026-04-18"', now);
    upsert.run('mindlore-diary', 'last_date', '"2026-04-19"', now);

    const row = db.prepare(
      'SELECT * FROM skill_memory WHERE skill_name = ? AND key = ?'
    ).get('mindlore-diary', 'last_date') as Record<string, unknown>;

    expect(row.value).toBe('"2026-04-19"');
    expect(row.access_count).toBe(1);
  });

  it('migration is idempotent', () => {
    expect(() => runMigrations(db, V052_MIGRATIONS)).not.toThrow();
  });
});
