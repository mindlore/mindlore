'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_PROJECT = path.join(__dirname, '..', '.test-mindlore-init');
const INIT_SCRIPT = path.join(__dirname, '..', 'scripts', 'init.cjs');

beforeEach(() => {
  fs.mkdirSync(TEST_PROJECT, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_PROJECT, { recursive: true, force: true });
});

describe('mindlore init', () => {
  test('should create 9 directories under .mindlore/', () => {
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env: { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT },
    });

    const mindloreDir = path.join(TEST_PROJECT, '.mindlore');
    expect(fs.existsSync(mindloreDir)).toBe(true);

    const expectedDirs = [
      'raw', 'sources', 'domains', 'analyses', 'insights',
      'connections', 'learnings', 'diary', 'decisions',
    ];

    for (const dir of expectedDirs) {
      expect(fs.existsSync(path.join(mindloreDir, dir))).toBe(true);
    }
  });

  test('should copy template files', () => {
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env: { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT },
    });

    const mindloreDir = path.join(TEST_PROJECT, '.mindlore');
    expect(fs.existsSync(path.join(mindloreDir, 'INDEX.md'))).toBe(true);
    expect(fs.existsSync(path.join(mindloreDir, 'log.md'))).toBe(true);
    expect(fs.existsSync(path.join(mindloreDir, 'SCHEMA.md'))).toBe(true);
  });

  test('should create FTS5 database', () => {
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env: { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT },
    });

    const dbPath = path.join(TEST_PROJECT, '.mindlore', 'mindlore.db');
    expect(fs.existsSync(dbPath)).toBe(true);

    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });

    // Verify FTS5 table exists
    const result = db
      .prepare('SELECT count(*) as cnt FROM mindlore_fts')
      .get();
    expect(result.cnt).toBe(0); // Empty but exists

    // Verify file_hashes table exists
    const hashResult = db
      .prepare('SELECT count(*) as cnt FROM file_hashes')
      .get();
    expect(hashResult.cnt).toBe(0);

    db.close();
  });

  test('should be idempotent — running twice preserves existing data', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    // First run
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // Add a file to .mindlore/
    const testFile = path.join(TEST_PROJECT, '.mindlore', 'sources', 'test.md');
    fs.writeFileSync(testFile, '---\nslug: test\ntype: source\n---\n# Test\n');

    // Second run
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // File should still exist
    expect(fs.existsSync(testFile)).toBe(true);
    const content = fs.readFileSync(testFile, 'utf8');
    expect(content).toContain('# Test');
  });
});
