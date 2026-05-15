import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { openDatabaseTs } from '../scripts/lib/db-helpers';

const tmpDb = path.join(os.tmpdir(), `vec-${Date.now()}.db`);

beforeAll(() => {
  const init = new Database(tmpDb);
  init.close();
});

afterAll(() => { if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb); });

test('openDatabaseTs with loadVec=true loads sqlite-vec exactly once per connection', () => {
  const db = openDatabaseTs(tmpDb, { loadVec: true });
  expect(db).not.toBeNull();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test assertion: vec_version() always returns an object with v
  const row = db!.prepare("SELECT vec_version() AS v").get() as { v: string };
  expect(typeof row.v).toBe('string');
  db!.close();
});

test('openDatabaseTs with loadVec=false does not error if vec not loaded', () => {
  const db = openDatabaseTs(tmpDb, { loadVec: false });
  expect(db).not.toBeNull();
  expect(() => db!.prepare("SELECT vec_version() AS v").get()).toThrow();
  db!.close();
});
