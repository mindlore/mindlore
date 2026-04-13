import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getExecStdout } from './helpers/exec.js';

const TEST_DIR = path.join(__dirname, '..', '.test-backup');
const MINDLORE_DIR = path.join(TEST_DIR, '.mindlore');
const BACKUP_SCRIPT = path.resolve(__dirname, '..', 'dist', 'scripts', 'mindlore-backup.js');

function runBackup(args: string): string {
  try {
    return execSync(`node "${BACKUP_SCRIPT}" ${args}`, {
      encoding: 'utf8',
      timeout: 15000,
      env: {
        ...process.env,
        MINDLORE_HOME: MINDLORE_DIR,
        GIT_AUTHOR_NAME: 'test',
        GIT_AUTHOR_EMAIL: 'test@test.com',
        GIT_COMMITTER_NAME: 'test',
        GIT_COMMITTER_EMAIL: 'test@test.com',
      },
    });
  } catch (err) {
    return getExecStdout(err);
  }
}

beforeEach(() => {
  fs.mkdirSync(path.join(MINDLORE_DIR, 'diary'), { recursive: true });
  fs.writeFileSync(path.join(MINDLORE_DIR, 'INDEX.md'), '# Test Index\n', 'utf8');
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('mindlore backup', () => {
  test('init creates .gitignore and git repo', () => {
    runBackup('init');

    const gitignorePath = path.join(MINDLORE_DIR, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toContain('*.db');
    expect(content).toContain('_session-reads-*.json');
    expect(content).toContain('_pattern-cache-*.json');

    const gitDir = path.join(MINDLORE_DIR, '.git');
    expect(fs.existsSync(gitDir)).toBe(true);
  });

  test('init creates initial commit', () => {
    runBackup('init');

    const log = execSync('git log --oneline -1', {
      cwd: MINDLORE_DIR,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    expect(log).toContain('backup init');
  });

  test('status shows last commit after init', () => {
    runBackup('init');
    const output = runBackup('status');

    expect(output).toContain('Last commit');
    expect(output).toContain('backup init');
  });

  test('now commits new changes', () => {
    runBackup('init');

    // Add a new file after init
    fs.writeFileSync(path.join(MINDLORE_DIR, 'diary', 'delta-test.md'), '# Test\n', 'utf8');

    runBackup('now');

    const log = execSync('git log --oneline -2', {
      cwd: MINDLORE_DIR,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    const lines = log.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('mindlore backup');
  });

  test('now reports clean tree when nothing to commit', () => {
    runBackup('init');
    const output = runBackup('now');

    expect(output).toContain('Nothing to commit');
  });

  test('shows usage when no subcommand given', () => {
    const output = runBackup('');
    expect(output).toContain('Usage');
  });

  test('gitignore excludes db and cache files', () => {
    runBackup('init');

    // Create files that should be ignored
    fs.writeFileSync(path.join(MINDLORE_DIR, 'mindlore.db'), 'fake-db', 'utf8');
    fs.writeFileSync(path.join(MINDLORE_DIR, 'diary', '_session-reads-test.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(MINDLORE_DIR, 'diary', '_pattern-cache-test.json'), '{}', 'utf8');

    const status = execSync('git status --porcelain', {
      cwd: MINDLORE_DIR,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    // These files should not appear in git status (gitignored)
    expect(status).not.toContain('mindlore.db');
    expect(status).not.toContain('_session-reads');
    expect(status).not.toContain('_pattern-cache');
  });
});
