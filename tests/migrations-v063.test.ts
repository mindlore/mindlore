import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createTestDbWithFullSchema, createTestDbWithEpisodes, insertFts } from './helpers/db.js';
import { ensureSchemaTable, runMigrations } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V051_MIGRATIONS } from '../scripts/lib/migrations-v051.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';
import { V062_MIGRATIONS } from '../scripts/lib/migrations-v062.js';
import { V063_MIGRATIONS } from '../scripts/lib/migrations-v063.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-mig063-'));
}

function cleanup(dir: string, db?: Database.Database): void {
  try { db?.close(); } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
}

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

describe('v0.6.3 migrations', () => {
  test('migration creates trigram table', () => {
    const dir = makeTmpDir();
    const db = createTestDbWithFullSchema(path.join(dir, 'mindlore.db'));
    const tables = db.prepare("SELECT name FROM sqlite_master").all() as Array<{ name: string }>;
    const names = tables.map(t => t.name);
    expect(names).toContain('mindlore_fts_trigram');
    cleanup(dir, db);
  });

  test('migration creates vocabulary table', () => {
    const dir = makeTmpDir();
    const db = createTestDbWithFullSchema(path.join(dir, 'mindlore.db'));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const names = tables.map(t => t.name);
    expect(names).toContain('vocabulary');
    cleanup(dir, db);
  });

  test('trigram table copies existing porter data on migration', () => {
    const dir = makeTmpDir();
    const dbPath = path.join(dir, 'mindlore.db');
    const db = createTestDbWithEpisodes(dbPath);

    insertFts(db, {
      path: '/test/doc.md',
      slug: 'test-doc',
      description: 'Test document',
      type: 'source',
      category: 'sources',
      title: 'Test Doc',
      content: 'Some content here',
      tags: 'test',
    });

    const porterBefore = (db.prepare('SELECT COUNT(*) as c FROM mindlore_fts').get() as { c: number }).c;
    expect(porterBefore).toBe(1);

    ensureSchemaTable(db);
    runMigrations(db, [...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS, ...V053_MIGRATIONS, ...V062_MIGRATIONS, ...V063_MIGRATIONS]);

    const trigramCount = (db.prepare('SELECT COUNT(*) as c FROM mindlore_fts_trigram').get() as { c: number }).c;
    expect(trigramCount).toBe(1);
    cleanup(dir, db);
  });

  test('schema version is 19 after migration', () => {
    const dir = makeTmpDir();
    const db = createTestDbWithFullSchema(path.join(dir, 'mindlore.db'));
    const row = db.prepare('SELECT MAX(version) as v FROM schema_versions').get() as { v: number };
    expect(row.v).toBe(19);
    cleanup(dir, db);
  });

  test('vocabulary table accepts inserts and dedup', () => {
    const dir = makeTmpDir();
    const db = createTestDbWithFullSchema(path.join(dir, 'mindlore.db'));
    db.prepare('INSERT INTO vocabulary (word) VALUES (?)').run('typescript');
    db.prepare('INSERT OR IGNORE INTO vocabulary (word) VALUES (?)').run('typescript');
    const count = (db.prepare('SELECT COUNT(*) as c FROM vocabulary').get() as { c: number }).c;
    expect(count).toBe(1);
    cleanup(dir, db);
  });
});
