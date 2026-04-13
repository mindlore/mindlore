import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { setupTestDir, teardownTestDir } from './helpers/db.js';

const PROJECT_DIR = path.join(__dirname, '..', '.test-project-readguard');
const TEST_DIR = path.join(PROJECT_DIR, '.mindlore');
const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-read-guard.cjs');
const PROJECT_NAME = path.basename(PROJECT_DIR);

beforeEach(() => {
  setupTestDir(TEST_DIR, ['diary']);
  fs.writeFileSync(path.join(TEST_DIR, 'INDEX.md'), '# Index\n', 'utf8');
  fs.writeFileSync(path.join(PROJECT_DIR, 'README.md'), '# Test\n', 'utf8');
});

afterEach(() => {
  teardownTestDir(PROJECT_DIR);
});

interface RunGuardResult {
  stdout: string;
  stderr?: string;
  exitCode: number;
}

function runGuard(input: string): RunGuardResult {
  try {
    const result = execSync(`node "${HOOK_PATH}"`, {
      input,
      encoding: 'utf8',
      timeout: 5000,
      cwd: PROJECT_DIR,
      env: { ...process.env, MINDLORE_HOME: TEST_DIR },
    });
    return { stdout: result.trim(), exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (e.stdout ?? '').trim(),
      stderr: (e.stderr ?? '').trim(),
      exitCode: e.status ?? 0,
    };
  }
}

describe('Read Guard Hook', () => {
  test('should not warn on first read', () => {
    const input = JSON.stringify({ file_path: path.join(PROJECT_DIR, 'README.md') });
    const { stdout } = runGuard(input);
    expect(stdout).toBe('');
  });

  test('should create project-namespaced _session-reads file on first read', () => {
    const input = JSON.stringify({ file_path: path.join(PROJECT_DIR, 'README.md') });
    runGuard(input);
    const readsPath = path.join(TEST_DIR, 'diary', `_session-reads-${PROJECT_NAME}.json`);
    expect(fs.existsSync(readsPath)).toBe(true);
  });

  test('should skip files inside .mindlore/', () => {
    const input = JSON.stringify({ file_path: path.join(TEST_DIR, 'INDEX.md') });
    runGuard(input);
    const readsPath = path.join(TEST_DIR, 'diary', `_session-reads-${PROJECT_NAME}.json`);
    if (fs.existsSync(readsPath)) {
      const reads = JSON.parse(fs.readFileSync(readsPath, 'utf8')) as Record<string, unknown>;
      const keys = Object.keys(reads);
      const mindloreKeys = keys.filter((k) => k.includes('.mindlore'));
      expect(mindloreKeys).toHaveLength(0);
    }
  });

  test('should handle empty input gracefully', () => {
    const { exitCode } = runGuard('');
    expect(exitCode).toBe(0);
  });
});
