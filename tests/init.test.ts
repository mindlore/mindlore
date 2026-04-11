import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';

const TEST_PROJECT = path.join(__dirname, '..', '.test-mindlore-init');
// init.ts → compiled to dist/scripts/init.js via tsc
const INIT_SCRIPT = path.join(__dirname, '..', 'dist', 'scripts', 'init.js');

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

    const db = new Database(dbPath, { readonly: true });

    const result = db
      .prepare('SELECT count(*) as cnt FROM mindlore_fts')
      .get() as { cnt: number };
    expect(result.cnt).toBe(0);

    const hashResult = db
      .prepare('SELECT count(*) as cnt FROM file_hashes')
      .get() as { cnt: number };
    expect(hashResult.cnt).toBe(0);

    db.close();
  });

  test('should be idempotent — running twice preserves existing data', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    const testFile = path.join(TEST_PROJECT, '.mindlore', 'sources', 'test.md');
    fs.writeFileSync(testFile, '---\nslug: test\ntype: source\n---\n# Test\n');

    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    expect(fs.existsSync(testFile)).toBe(true);
    const content = fs.readFileSync(testFile, 'utf8');
    expect(content).toContain('# Test');
  });

  test('--global should create ~/.mindlore/ instead of project .mindlore/', () => {
    const globalDir = path.join(TEST_PROJECT, '.mindlore');
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    execSync(`node "${INIT_SCRIPT}" init --global`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    expect(fs.existsSync(globalDir)).toBe(true);

    const expectedDirs = [
      'raw', 'sources', 'domains', 'analyses', 'insights',
      'connections', 'learnings', 'diary', 'decisions',
    ];

    for (const dir of expectedDirs) {
      expect(fs.existsSync(path.join(globalDir, dir))).toBe(true);
    }

    // Global mode should NOT create .gitignore entry in project
    const gitignorePath = path.join(TEST_PROJECT, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf8');
      // .gitignore should not have been modified by --global
      expect(gitignore).not.toContain('.mindlore/');
    }
  });
});
