import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { spawnSync } from 'child_process';

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-nom-'));
const mindloreDir = path.join(tmpHome, '.mindlore');
fs.mkdirSync(mindloreDir, { recursive: true });
const dbPath = path.join(mindloreDir, 'mindlore.db');

beforeAll(() => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE episodes (
    id TEXT PRIMARY KEY,
    kind TEXT,
    scope TEXT,
    project TEXT,
    summary TEXT,
    body TEXT,
    tags TEXT,
    entities TEXT,
    parent_id TEXT,
    status TEXT,
    supersedes TEXT,
    source TEXT,
    created_at TEXT,
    consolidation_status TEXT,
    graduated_at TEXT,
    session_summary TEXT
  )`);
  db.prepare(`INSERT INTO episodes(id, kind, scope, status, project, summary, body, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run('ep-test-1', 'nomination', 'project', 'staged', 'mindlore', 'test rule', 'body', 'test');
  db.close();
});

afterAll(() => { fs.rmSync(tmpHome, { recursive: true, force: true }); });

test('session-focus injects [Mindlore Nomination] block when staged nominations exist', () => {
  const hook = path.join(__dirname, '..', 'hooks', 'mindlore-session-focus.cjs');
  const r = spawnSync('node', [hook], {
    env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome, MINDLORE_HOME: mindloreDir },
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
  });
  expect(r.stdout).toContain('[Mindlore Nomination]');
});
