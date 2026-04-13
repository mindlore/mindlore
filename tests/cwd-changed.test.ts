import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { setupTestDir, teardownTestDir } from './helpers/db';
import { readJsonFile } from '../scripts/lib/safe-parse.js';

const TEST_DIR = path.join(__dirname, '..', '.test-cwd-changed');
const FAKE_PROJECT_A = path.join(TEST_DIR, 'project-a');
const FAKE_PROJECT_B = path.join(TEST_DIR, 'project-b');
const HOOK_SCRIPT = path.resolve(__dirname, '..', 'hooks', 'mindlore-cwd-changed.cjs');

beforeEach(() => {
  setupTestDir(TEST_DIR);
  fs.mkdirSync(FAKE_PROJECT_A, { recursive: true });
  fs.mkdirSync(FAKE_PROJECT_B, { recursive: true });
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('mindlore-cwd-changed hook', () => {
  test('writes _scope.json when .mindlore/ exists', () => {
    // Create .mindlore/ in project A
    const mindloreDir = path.join(FAKE_PROJECT_A, '.mindlore');
    const diaryDir = path.join(mindloreDir, 'diary');
    fs.mkdirSync(diaryDir, { recursive: true });

    execSync(`node "${HOOK_SCRIPT}"`, {
      cwd: FAKE_PROJECT_A,
      stdio: 'pipe',
      env: { ...process.env, HOME: TEST_DIR, USERPROFILE: TEST_DIR, MINDLORE_HOME: mindloreDir },
    });

    const scopePath = path.join(diaryDir, '_scope.json');
    expect(fs.existsSync(scopePath)).toBe(true);

    const scope = readJsonFile<{ scope: string; dir: string }>(scopePath);
    expect(scope.scope).toBe('global');
    expect(scope.dir).toBe(mindloreDir);
  });

  test('outputs warning to stderr when no .mindlore/ exists', () => {
    const nonExistent = path.join(TEST_DIR, 'no-mindlore');
    // Hook outputs to stderr — capture via 2>&1
    const result = execSync(`node "${HOOK_SCRIPT}" 2>&1`, {
      cwd: FAKE_PROJECT_B,
      encoding: 'utf8',
      env: { ...process.env, HOME: TEST_DIR, USERPROFILE: TEST_DIR, MINDLORE_HOME: nonExistent },
    });
    expect(result).toContain('mindlore kurulu degil');
  });

  test('scope.json has correct timestamp format', () => {
    const mindloreDir = path.join(FAKE_PROJECT_A, '.mindlore');
    const diaryDir = path.join(mindloreDir, 'diary');
    fs.mkdirSync(diaryDir, { recursive: true });

    execSync(`node "${HOOK_SCRIPT}"`, {
      cwd: FAKE_PROJECT_A,
      stdio: 'pipe',
      env: { ...process.env, HOME: TEST_DIR, USERPROFILE: TEST_DIR, MINDLORE_HOME: mindloreDir },
    });

    const scope = readJsonFile<{ timestamp: string; cwd: string }>(
      path.join(diaryDir, '_scope.json')
    );
    expect(scope.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(scope.cwd).toBe(FAKE_PROJECT_A);
  });
});
