import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ensureSchemaTable, runMigrations } from '../scripts/lib/schema-version';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052';
import { getSkillMem, setSkillMem, bumpAccess, listSkillMem } from '../scripts/lib/skill-memory';

describe('skill-memory API', () => {
  let dbPath: string;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-skillmem-api-'));
    dbPath = path.join(tmpDir, 'test.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    ensureSchemaTable(db);
    runMigrations(db, V052_MIGRATIONS);
    db.close();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('setSkillMem + getSkillMem roundtrip', () => {
    setSkillMem(dbPath, 'mindlore-diary', 'last_date', '2026-04-18');
    const value = getSkillMem(dbPath, 'mindlore-diary', 'last_date');
    expect(value).toBe('2026-04-18');
  });

  it('getSkillMem returns null for missing key', () => {
    const value = getSkillMem(dbPath, 'mindlore-diary', 'nonexistent');
    expect(value).toBeNull();
  });

  it('setSkillMem overwrites existing value', () => {
    setSkillMem(dbPath, 'mindlore-ingest', 'urls', '["a.com"]');
    setSkillMem(dbPath, 'mindlore-ingest', 'urls', '["a.com","b.com"]');
    const value = getSkillMem(dbPath, 'mindlore-ingest', 'urls');
    expect(value).toBe('["a.com","b.com"]');
  });

  it('bumpAccess increments access_count', () => {
    setSkillMem(dbPath, 'mindlore-query', 'log', '[]');
    bumpAccess(dbPath, 'mindlore-query', 'log');
    bumpAccess(dbPath, 'mindlore-query', 'log');

    const db2 = new Database(dbPath, { readonly: true });
    const row = db2.prepare(
      'SELECT access_count FROM skill_memory WHERE skill_name = ? AND key = ?'
    ).get('mindlore-query', 'log') as { access_count: number };
    db2.close();
    expect(row.access_count).toBe(2);
  });

  it('listSkillMem returns all keys for a skill', () => {
    setSkillMem(dbPath, 'mindlore-diary', 'last_date', '2026-04-18');
    setSkillMem(dbPath, 'mindlore-diary', 'session_count', '5');
    setSkillMem(dbPath, 'mindlore-ingest', 'urls', '[]');

    const keys = listSkillMem(dbPath, 'mindlore-diary');
    expect(keys).toHaveLength(2);
    expect(keys.map(k => k.key).sort()).toEqual(['last_date', 'session_count']);
  });
});
