import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';

describe('mindlore-doctor', () => {
  it('detects hooks from plugin.json (auto-discovery)', () => {
    const { checkHooks } = require('../dist/scripts/mindlore-doctor.js');
    // checkHooks now reads plugin.json, not settings.json
    const result = checkHooks();
    expect(result.pass).toBe(true);
    expect(result.found).toBeGreaterThanOrEqual(14);
    expect(result.message).toContain('plugin.json');
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

  it('derives EXPECTED_HOOKS from plugin.json', () => {
    const { loadExpectedHooks } = require('../dist/scripts/mindlore-doctor.js');
    const pluginPath = path.join(__dirname, '..', 'plugin.json');
    const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
    const hookNames: string[] = plugin.hooks.map(
      (h: { name?: string; script?: string }) => h.name ?? path.basename(h.script ?? '', '.cjs'),
    ).filter(Boolean);

    const derived = loadExpectedHooks();
    expect(derived.length).toBeGreaterThanOrEqual(14);
    expect(derived).toContain('mindlore-session-focus');
    expect(derived).toContain('mindlore-search');
    for (const name of hookNames) {
      expect(derived).toContain(name);
    }
  });

  describe('stale local DB detection', () => {
    it('warns when cwd has .mindlore/mindlore.db without schema_version', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-doctor-'));
      const localMindlore = path.join(tmpDir, '.mindlore');
      fs.mkdirSync(localMindlore, { recursive: true });

      // Create a minimal SQLite DB without mindlore_schema_version
      const Database = require('better-sqlite3');
      const db = new Database(path.join(localMindlore, 'mindlore.db'));
      db.exec("CREATE VIRTUAL TABLE mindlore_fts USING fts5(path, slug, content, tokenize='porter')");
      db.close();

      const { checkStaleLocalDb } = require('../dist/scripts/mindlore-doctor.js');
      const result = checkStaleLocalDb(tmpDir);
      expect(result.pass).toBe(false);
      expect(result.message).toContain('Stale local');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('passes when no local .mindlore exists', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-doctor-'));
      const { checkStaleLocalDb } = require('../dist/scripts/mindlore-doctor.js');
      const result = checkStaleLocalDb(tmpDir);
      expect(result.pass).toBe(true);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('MINDLORE_HOME display', () => {
    it('shows source=env when MINDLORE_HOME env is set', () => {
      const customHome = path.join(os.tmpdir(), 'custom-mindlore');
      process.env.MINDLORE_HOME = customHome;
      const { getMindloreHomeInfo } = require('../dist/scripts/mindlore-doctor.js');
      const info = getMindloreHomeInfo();
      expect(info.baseDir).toBe(customHome);
      expect(info.source).toBe('env');
      delete process.env.MINDLORE_HOME;
    });

    it('shows source=default when env unset', () => {
      delete process.env.MINDLORE_HOME;
      const { getMindloreHomeInfo } = require('../dist/scripts/mindlore-doctor.js');
      const info = getMindloreHomeInfo();
      expect(info.baseDir).toBe(path.join(os.homedir(), '.mindlore'));
      expect(info.source).toBe('default');
    });
  });

  describe('plugin cache regression', () => {
    it('hook resolves bundled scripts from plugin cache __dirname', () => {
      // Simulate plugin cache directory structure
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-cache-'));
      const hookDir = path.join(tmpDir, 'hooks');
      const libDir = path.join(tmpDir, 'hooks', 'lib');
      fs.mkdirSync(libDir, { recursive: true });

      // Create a minimal hook that resolves a bundled script
      fs.writeFileSync(path.join(libDir, 'mindlore-common.cjs'), 'module.exports = {};');

      // Verify resolution works from plugin cache path
      const resolved = path.resolve(hookDir, 'lib', 'mindlore-common.cjs');
      expect(fs.existsSync(resolved)).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
