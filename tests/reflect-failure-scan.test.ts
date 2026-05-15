import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { spawnSync } from 'child_process';

let tmpHome: string;
let mindloreDir: string;
let dbPath: string;
let telemetryPath: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-failscan-'));
  mindloreDir = path.join(tmpHome, '.mindlore');
  fs.mkdirSync(mindloreDir, { recursive: true });
  dbPath = path.join(mindloreDir, 'mindlore.db');
  telemetryPath = path.join(mindloreDir, 'telemetry.jsonl');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE episodes (
    id INTEGER PRIMARY KEY,
    kind TEXT, status TEXT, project TEXT,
    summary TEXT, body TEXT, source TEXT,
    created_at TEXT
  )`);
  db.close();
  fs.writeFileSync(telemetryPath, [
    JSON.stringify({ ts: '2026-05-15T10:00:00Z', skill: 's1', script: 'x', ok: false, exit_code: 1, output: 'Error: boom' }),
    JSON.stringify({ ts: '2026-05-15T10:01:00Z', skill: 's1', script: 'x', ok: false, exit_code: 1, output: 'Error: boom again' }),
    JSON.stringify({ ts: '2026-05-15T10:02:00Z', skill: 's1', script: 'x', ok: false, exit_code: 1, output: 'Error: third time' }),
  ].join('\n') + '\n');
});

afterEach(() => { fs.rmSync(tmpHome, { recursive: true, force: true }); });

test('reflect-failure-scan inserts skill_failure episodes for matched failures', () => {
  const script = path.join(__dirname, '..', 'dist', 'scripts', 'reflect-failure-scan.js');
  const r = spawnSync('node', [script], {
    env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome, MINDLORE_HOME: mindloreDir },
    encoding: 'utf8',
  });
  expect(r.status).toBe(0);
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare("SELECT * FROM episodes WHERE kind = 'skill_failure'").all();
  db.close();
  expect(rows.length).toBe(3);
});
