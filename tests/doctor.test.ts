import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';

describe('mindlore-doctor', () => {
  it('detects missing hooks', () => {
    const { checkHooks } = require('../dist/scripts/mindlore-doctor.js');
    const result = checkHooks({});
    expect(result.pass).toBe(false);
    expect(result.found).toBe(0);
  });

  it('detects hooks when settings has them', () => {
    const { checkHooks } = require('../dist/scripts/mindlore-doctor.js');
    const settings = {
      hooks: {
        SessionStart: [{ command: 'mindlore-session-focus' }],
        UserPromptSubmit: [{ command: 'mindlore-search' }],
      },
    };
    const result = checkHooks(settings);
    expect(result.found).toBeGreaterThan(0);
  });

  it('detects correct Node version', () => {
    const { checkNodeVersion } = require('../dist/scripts/mindlore-doctor.js');
    const result = checkNodeVersion();
    expect(result.pass).toBe(true);
  });

  it('detects DB health for valid DB', () => {
    const { checkDatabase } = require('../dist/scripts/mindlore-doctor.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-'));
    const dbPath = path.join(tmpDir, 'mindlore.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE test (id INTEGER)');
    db.close();

    const result = checkDatabase(tmpDir);
    expect(result.pass).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects missing DB', () => {
    const { checkDatabase } = require('../dist/scripts/mindlore-doctor.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-'));
    const result = checkDatabase(tmpDir);
    expect(result.pass).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('checks config version match', () => {
    const { checkConfigVersion } = require('../dist/scripts/mindlore-doctor.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-'));
    const pkgVersion = require('../package.json').version;
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ version: pkgVersion }));
    const result = checkConfigVersion(tmpDir, pkgVersion);
    expect(result.pass).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects config version mismatch', () => {
    const { checkConfigVersion } = require('../dist/scripts/mindlore-doctor.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-'));
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ version: '0.0.1' }));
    const result = checkConfigVersion(tmpDir, '0.6.1');
    expect(result.pass).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
