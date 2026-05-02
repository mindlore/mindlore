import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import { dbGet } from '../scripts/lib/db-helpers.js';
import { readJsonFile } from '../scripts/lib/safe-parse.js';

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
  test('should create 11 directories under .mindlore/', () => {
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env: { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT },
    });

    const mindloreDir = path.join(TEST_PROJECT, '.mindlore');
    expect(fs.existsSync(mindloreDir)).toBe(true);

    const expectedDirs = [
      'raw', 'sources', 'domains', 'analyses', 'insights',
      'connections', 'learnings', 'diary', 'decisions', 'logs', 'memory',
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

    const indexContent = fs.readFileSync(path.join(mindloreDir, 'INDEX.md'), 'utf8');
    expect(indexContent).toContain('## Connections');
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

    const result = dbGet<{ cnt: number }>(db, 'SELECT count(*) as cnt FROM mindlore_fts');
    expect(result?.cnt).toBe(0);

    const hashResult = dbGet<{ cnt: number }>(db, 'SELECT count(*) as cnt FROM file_hashes');
    expect(hashResult?.cnt).toBe(0);

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

  test('should create config.json with model defaults', () => {
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env: { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT },
    });

    const configPath = path.join(TEST_PROJECT, '.mindlore', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = readJsonFile<{ models: Record<string, string> }>(configPath);
    expect(config.models).toBeDefined();
    expect(config.models.ingest).toBe('haiku');
    expect(config.models.evolve).toBe('sonnet');
    expect(config.models.explore).toBe('sonnet');
    expect(config.models.default).toBe('haiku');
  });

  test('should preserve existing config.json models on re-init', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // User overrides ingest model
    const configPath = path.join(TEST_PROJECT, '.mindlore', 'config.json');
    const config = readJsonFile<{ models: Record<string, string> }>(configPath);
    config.models.ingest = 'sonnet';
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

    // Re-run init
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // User override should be preserved
    const updated = readJsonFile<{ models: Record<string, string> }>(configPath);
    expect(updated.models.ingest).toBe('sonnet');
  });

  test('should add models to existing config.json without models field', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // Simulate config without models (e.g. from older version)
    const configPath = path.join(TEST_PROJECT, '.mindlore', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ version: '0.3.0', customField: true }, null, 2) + '\n', 'utf8');

    // Re-run init
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    const updated = readJsonFile<{ models: Record<string, string>; customField?: boolean }>(configPath);
    expect(updated.models).toBeDefined();
    expect(updated.models.ingest).toBe('haiku');
    // Custom field should be preserved
    expect(updated.customField).toBe(true);
  });

  test('should migrate project .mindlore/ to .mindlore.bak/ on init', () => {
    const projectDir = path.join(TEST_PROJECT, 'myproject');
    fs.mkdirSync(projectDir, { recursive: true });

    // Simulate existing project .mindlore/ with data
    const projectMindlore = path.join(projectDir, '.mindlore');
    fs.mkdirSync(projectMindlore, { recursive: true });
    fs.writeFileSync(path.join(projectMindlore, 'old-note.md'), '# Old data');

    const homeDir = path.join(TEST_PROJECT, 'home');
    fs.mkdirSync(homeDir, { recursive: true });

    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: projectDir,
      stdio: 'pipe',
      env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
    });

    // Project .mindlore/ should be renamed to .mindlore.bak/
    expect(fs.existsSync(projectMindlore)).toBe(false);
    const backupDir = path.join(projectDir, '.mindlore.bak');
    expect(fs.existsSync(backupDir)).toBe(true);
    expect(fs.existsSync(path.join(backupDir, 'old-note.md'))).toBe(true);

    // Global ~/.mindlore/ should have been created
    expect(fs.existsSync(path.join(homeDir, '.mindlore'))).toBe(true);
  });

  test('should list all CLI subcommands', () => {
    const initSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'init.ts'), 'utf8');
    const required = ['health', 'search', 'index', 'quality', 'backup', 'obsidian', 'episodes', 'memory-sync', 'fetch-raw'];
    for (const cmd of required) {
      // Keys with hyphens use quotes, simple keys don't — match either form
      const hasKey = initSource.includes(`'${cmd}'`) || initSource.includes(`${cmd}:`);
      expect(hasKey).toBe(true);
    }
  });

  test('config template should have backup and reminders', () => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'templates', 'config.json'), 'utf8'));
    expect(config.backup).toBeDefined();
    expect(config.reminders).toBeDefined();
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(config.version).toBe(pkg.version);
  });

  test('should handle v0.5.3 schema without logs/memory dirs gracefully', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    // First init to get full structure
    execSync(`node "${INIT_SCRIPT}" init`, { cwd: TEST_PROJECT, stdio: 'pipe', env });

    const mindloreDir = path.join(TEST_PROJECT, '.mindlore');

    // Remove logs/ and memory/ to simulate v0.5.3-style directory
    fs.rmSync(path.join(mindloreDir, 'logs'), { recursive: true, force: true });
    fs.rmSync(path.join(mindloreDir, 'memory'), { recursive: true, force: true });
    expect(fs.existsSync(path.join(mindloreDir, 'logs'))).toBe(false);
    expect(fs.existsSync(path.join(mindloreDir, 'memory'))).toBe(false);

    // Re-run init — should recreate missing dirs without error
    execSync(`node "${INIT_SCRIPT}" init`, { cwd: TEST_PROJECT, stdio: 'pipe', env });

    expect(fs.existsSync(path.join(mindloreDir, 'logs'))).toBe(true);
    expect(fs.existsSync(path.join(mindloreDir, 'memory'))).toBe(true);

    // Existing dirs should still be intact
    expect(fs.existsSync(path.join(mindloreDir, 'sources'))).toBe(true);
    expect(fs.existsSync(path.join(mindloreDir, 'domains'))).toBe(true);
  });

  test('should recognize --upgrade flag and run upgrade path', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    // First init to create base structure
    execSync(`node "${INIT_SCRIPT}" init`, { cwd: TEST_PROJECT, stdio: 'pipe', env });

    // Write old version to config to simulate upgrade scenario
    const configPath = path.join(TEST_PROJECT, '.mindlore', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.version = '0.5.0';
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    // Run with --upgrade flag
    execSync(`node "${INIT_SCRIPT}" upgrade`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // Config version should be updated
    const updated = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(updated.version).toBe(pkg.version);
  });

  describe('extraction templates', () => {
    it('should copy extraction templates to .mindlore/templates/extraction/', () => {
      execSync(`node "${INIT_SCRIPT}" init`, {
        cwd: TEST_PROJECT,
        stdio: 'pipe',
        env: { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT },
      });

      const extractionDir = path.join(TEST_PROJECT, '.mindlore', 'templates', 'extraction');
      expect(fs.existsSync(extractionDir)).toBe(true);
      const files = fs.readdirSync(extractionDir);
      expect(files).toContain('github-repo.md');
      expect(files).toContain('article.md');
      expect(files).toContain('docs.md');
      expect(files).toContain('changelog.md');
      expect(files).toContain('default.md');
    });

    it('should preserve user-customized templates on re-init', () => {
      const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

      execSync(`node "${INIT_SCRIPT}" init`, { cwd: TEST_PROJECT, stdio: 'pipe', env });

      const extractionDir = path.join(TEST_PROJECT, '.mindlore', 'templates', 'extraction');
      fs.writeFileSync(path.join(extractionDir, 'github-repo.md'), 'custom content');

      execSync(`node "${INIT_SCRIPT}" init`, { cwd: TEST_PROJECT, stdio: 'pipe', env });

      const content = fs.readFileSync(path.join(extractionDir, 'github-repo.md'), 'utf8');
      expect(content).toBe('custom content');
    });
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
      'connections', 'learnings', 'diary', 'decisions', 'logs', 'memory',
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
