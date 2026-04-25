import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';
import os from 'os';
import fs from 'fs';

interface VecRow { rowid: number; distance: number }

describe('sqlite-vec on better-sqlite3 v12', () => {
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vec-v12-')), 'test.db');
    db = new Database(dbPath);
    sqliteVec.load(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  test('vec0 virtual table create + insert + cosine query', () => {
    db.exec('CREATE VIRTUAL TABLE vec_items USING vec0(embedding float[3])');
    const insert = db.prepare('INSERT INTO vec_items(embedding) VALUES (?)');
    insert.run(Buffer.from(new Float32Array([1, 0, 0]).buffer));
    insert.run(Buffer.from(new Float32Array([0, 1, 0]).buffer));
    const rows = db.prepare(
      'SELECT rowid, distance FROM vec_items WHERE embedding MATCH ? ORDER BY distance LIMIT 2'
    ).all(Buffer.from(new Float32Array([1, 0, 0]).buffer));
    expect(rows.length).toBe(2);
    expect((rows[0] as VecRow).rowid).toBe(1);
    expect((rows[0] as VecRow).distance).toBeCloseTo(0);
  });

  test('better-sqlite3 prepare + run works', () => {
    expect(() => db.prepare('SELECT 1').get()).not.toThrow();
  });
});
