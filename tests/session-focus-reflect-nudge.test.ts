import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { spawnSync } from 'child_process';

let tmpHome: string;
let mindloreDir: string;
let dbPath: string;

function setupDb(lastReflectDays: number | null, lastNudgeHours: number | null) {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-nudge-'));
  mindloreDir = path.join(tmpHome, '.mindlore');
  fs.mkdirSync(mindloreDir, { recursive: true });
  dbPath = path.join(mindloreDir, 'mindlore.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE skill_memory (skill_name TEXT, key TEXT, value TEXT, updated_at TEXT, access_count INTEGER DEFAULT 0, PRIMARY KEY(skill_name, key))`);
  const ins = db.prepare(`INSERT INTO skill_memory(skill_name, key, value, updated_at) VALUES (?, ?, ?, ?)`);
  if (lastReflectDays !== null) {
    ins.run('mindlore-reflect', 'last_reflect_date', new Date(Date.now() - lastReflectDays * 86400000).toISOString(), new Date().toISOString());
  }
  if (lastNudgeHours !== null) {
    ins.run('mindlore-reflect', 'last_nudge_date', new Date(Date.now() - lastNudgeHours * 3600000).toISOString(), new Date().toISOString());
  }
  db.close();
}

afterEach(() => { fs.rmSync(tmpHome, { recursive: true, force: true }); });

function runHook(): { stdout: string } {
  const hook = path.join(__dirname, '..', 'hooks', 'mindlore-session-focus.cjs');
  const r = spawnSync('node', [hook], {
    env: { ...process.env, MINDLORE_HOME: mindloreDir },
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
  });
  return { stdout: r.stdout || '' };
}

test('session-focus injects nudge when 7+ days passed and no recent nudge', () => {
  setupDb(8, null);
  expect(runHook().stdout).toContain('Son reflect');
});

test('session-focus suppresses nudge during 24h cooldown', () => {
  setupDb(8, 2);
  expect(runHook().stdout).not.toContain('Son reflect');
});

test('session-focus no nudge when reflect was recent (5 days)', () => {
  setupDb(5, null);
  expect(runHook().stdout).not.toContain('Son reflect');
});

test('session-focus writes last_nudge_date after injecting nudge', () => {
  setupDb(8, null);
  runHook();
  const db = new Database(dbPath, { readonly: true });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const row = db.prepare("SELECT value FROM skill_memory WHERE skill_name = 'mindlore-reflect' AND key = 'last_nudge_date'").get() as { value: string } | undefined;
  db.close();
  expect(row?.value).toBeTruthy();
});
