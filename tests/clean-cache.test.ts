import path from 'path';
import os from 'os';
import fs from 'fs';
import { spawnSync } from 'child_process';

let tmpHome: string;
let cacheDir: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-cache-'));
  cacheDir = path.join(tmpHome, '.claude', 'plugins', 'cache');
  for (const v of ['0.7.2', '0.7.3', '0.7.4']) {
    const d = path.join(cacheDir, 'mindlore', 'mindlore', v);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'marker.txt'), v);
  }
  const oldTemp = path.join(cacheDir, 'temp_npm_1234');
  fs.mkdirSync(oldTemp, { recursive: true });
  fs.utimesSync(oldTemp, new Date(Date.now() - 48 * 3600 * 1000), new Date(Date.now() - 48 * 3600 * 1000));
});

afterEach(() => { fs.rmSync(tmpHome, { recursive: true, force: true }); });

test('clean-cache removes stale version dirs except latest', () => {
  const script = path.join(__dirname, '..', 'dist', 'scripts', 'mindlore-clean-cache.js');
  const r = spawnSync('node', [script], {
    env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
    encoding: 'utf8',
  });
  expect(r.status).toBe(0);
  const versionDir = path.join(cacheDir, 'mindlore', 'mindlore');
  const remaining = fs.readdirSync(versionDir);
  expect(remaining).toContain('0.7.4');
  expect(remaining).not.toContain('0.7.2');
  expect(remaining).not.toContain('0.7.3');
});

test('clean-cache --dry-run does not delete', () => {
  const script = path.join(__dirname, '..', 'dist', 'scripts', 'mindlore-clean-cache.js');
  const r = spawnSync('node', [script, '--dry-run'], {
    env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
    encoding: 'utf8',
  });
  expect(r.status).toBe(0);
  const versionDir = path.join(cacheDir, 'mindlore', 'mindlore');
  const remaining = fs.readdirSync(versionDir);
  expect(remaining).toContain('0.7.2');
  expect(remaining).toContain('0.7.3');
});

test('clean-cache removes old temp_npm dirs (24h+)', () => {
  const script = path.join(__dirname, '..', 'dist', 'scripts', 'mindlore-clean-cache.js');
  spawnSync('node', [script], {
    env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
    encoding: 'utf8',
  });
  const entries = fs.readdirSync(cacheDir);
  expect(entries.some(e => e.startsWith('temp_npm_'))).toBe(false);
});
