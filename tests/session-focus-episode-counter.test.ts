import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';

const tmpDb = path.join(os.tmpdir(), `episode-counter-${Date.now()}.db`);

beforeAll(() => {
  const db = new Database(tmpDb);
  db.exec(`CREATE TABLE episodes (
    id INTEGER PRIMARY KEY,
    kind TEXT,
    consolidation_status TEXT,
    project TEXT
  )`);
  const ins = db.prepare("INSERT INTO episodes(kind, consolidation_status, project) VALUES (?, ?, 'mindlore')");
  for (let i = 0; i < 5; i++) ins.run('session', 'raw');
  for (let i = 0; i < 3; i++) ins.run('learning', 'raw');
  for (let i = 0; i < 2; i++) ins.run('learning', 'consolidated');
  db.close();
});

afterAll(() => { if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb); });

test('raw episode counter excludes session kinds and counts only knowledge raw', () => {
  const db = new Database(tmpDb, { readonly: true });
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM episodes
    WHERE (consolidation_status = 'raw' OR consolidation_status IS NULL)
      AND kind IN ('learning','discovery','friction','decision','nomination')
      AND project = ?
  `).get('mindlore');
  db.close();
  expect(row).toEqual({ c: 3 });
});
