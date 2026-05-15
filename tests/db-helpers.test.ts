import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { openDatabaseTs } from '../scripts/lib/db-helpers';
import { DB_BUSY_TIMEOUT_MS } from '../scripts/lib/constants';

const tmpDb = path.join(os.tmpdir(), `mindlore-test-${Date.now()}.db`);

afterAll(() => {
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDb + ext); } catch { /* ignore */ }
  }
});

test('openDatabaseTs sets WAL and busy_timeout for writable', () => {
  const init = new Database(tmpDb);
  init.close();
  const db = openDatabaseTs(tmpDb);
  expect(db).not.toBeNull();
  expect(db!.pragma('journal_mode', { simple: true })).toBe('wal');
  expect(db!.pragma('busy_timeout', { simple: true })).toBe(DB_BUSY_TIMEOUT_MS);
  db!.close();
});
