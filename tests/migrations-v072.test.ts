import path from 'path';
import fs from 'fs';
import os from 'os';
import { createTestDbWithFullSchema } from './helpers/db';
import { dbAll } from '../scripts/lib/db-helpers.js';

describe('migrations-v072', () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-mig072-'));
    dbPath = path.join(testDir, 'test.db');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates mindlore_relations table with correct schema', () => {
    const db = createTestDbWithFullSchema(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mindlore_relations'").all();
    expect(tables).toHaveLength(1);

    const cols = dbAll<{ name: string; type: string; notnull: number }>(db, "PRAGMA table_info(mindlore_relations)");
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('source_a');
    expect(colNames).toContain('source_b');
    expect(colNames).toContain('relation_type');
    expect(colNames).toContain('created_at');
    db.close();
  });

  it('enforces CHECK constraint on relation_type', () => {
    const db = createTestDbWithFullSchema(dbPath);
    expect(() => {
      db.prepare("INSERT INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('a', 'b', 'invalid')").run();
    }).toThrow();
    db.close();
  });

  it('enforces UNIQUE constraint on (source_a, source_b, relation_type)', () => {
    const db = createTestDbWithFullSchema(dbPath);
    db.prepare("INSERT INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('a', 'b', 'cites')").run();
    expect(() => {
      db.prepare("INSERT INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('a', 'b', 'cites')").run();
    }).toThrow();
    db.close();
  });

  it('allows INSERT OR IGNORE for idempotency', () => {
    const db = createTestDbWithFullSchema(dbPath);
    db.prepare("INSERT INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('a', 'b', 'cites')").run();
    const result = db.prepare("INSERT OR IGNORE INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('a', 'b', 'cites')").run();
    expect(result.changes).toBe(0);
    db.close();
  });

  it('creates indexes on source_a, source_b, relation_type', () => {
    const db = createTestDbWithFullSchema(dbPath);
    const indexes = dbAll<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='mindlore_relations'");
    const names = indexes.map(i => i.name);
    expect(names).toContain('idx_relations_source_a');
    expect(names).toContain('idx_relations_source_b');
    expect(names).toContain('idx_relations_type');
    db.close();
  });

  it('is idempotent on re-run', () => {
    const db = createTestDbWithFullSchema(dbPath);
    db.close();
    const db2 = createTestDbWithFullSchema(dbPath);
    const tables = db2.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mindlore_relations'").all();
    expect(tables).toHaveLength(1);
    db2.close();
  });
});
