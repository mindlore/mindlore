import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createTestDbWithFullSchema, insertEpisode } from './helpers/db.js';

const { getNominationCounts } = require('../hooks/lib/mindlore-common.cjs');

describe('getNominationCounts', () => {
  let db: Database.Database;
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-nom-counts-'));
    dbPath = path.join(tmpDir, 'test.db');
    db = createTestDbWithFullSchema(dbPath);
  });

  afterEach(() => {
    db.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('returns zero counts on empty table', () => {
    const result = getNominationCounts(db, 'test-project');
    expect(result).toEqual({ staged: 0, graduated: 0 });
  });

  test('counts staged nominations', () => {
    insertEpisode(db, { kind: 'nomination', status: 'staged', project: 'proj1' });
    insertEpisode(db, { kind: 'nomination', status: 'staged', project: 'proj1' });
    insertEpisode(db, { kind: 'nomination', status: 'approved', project: 'proj1' });
    const result = getNominationCounts(db, 'proj1');
    expect(result.staged).toBe(2);
  });

  test('counts graduated nominations', () => {
    insertEpisode(db, { kind: 'nomination', status: 'approved', project: 'proj1', graduated_at: '2026-01-01' });
    insertEpisode(db, { kind: 'nomination', status: 'approved', project: 'proj1', graduated_at: null });
    const result = getNominationCounts(db, 'proj1');
    expect(result.graduated).toBe(1);
  });

  test('filters by project', () => {
    insertEpisode(db, { kind: 'nomination', status: 'staged', project: 'proj1' });
    insertEpisode(db, { kind: 'nomination', status: 'staged', project: 'proj2' });
    const result = getNominationCounts(db, 'proj1');
    expect(result.staged).toBe(1);
  });
});
