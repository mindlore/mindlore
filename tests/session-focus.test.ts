import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-session-focus');
const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-session-focus.cjs');

function createMindloreDir(): string {
  const mindloreDir = path.join(TEST_DIR, '.mindlore');
  fs.mkdirSync(path.join(mindloreDir, 'diary'), { recursive: true });

  fs.writeFileSync(
    path.join(mindloreDir, 'INDEX.md'),
    '# Mindlore Index\n\n## Stats\n2 source, 1 analysis, 3 total\n'
  );

  return mindloreDir;
}

function createDelta(mindloreDir: string, name: string, content: string): void {
  fs.writeFileSync(
    path.join(mindloreDir, 'diary', name),
    content
  );
}

beforeEach(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Session Focus Hook', () => {
  test('should inject INDEX.md content when .mindlore/ exists', () => {
    createMindloreDir();

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).toContain('[Mindlore INDEX]');
    expect(output).toContain('2 source, 1 analysis, 3 total');
  });

  test('should inject latest delta when diary has entries', () => {
    const mindloreDir = createMindloreDir();

    createDelta(mindloreDir, 'delta-2026-04-09-1200.md', '# Old Delta\n\nOld session.');
    createDelta(mindloreDir, 'delta-2026-04-10-0900.md', '# Latest Delta\n\nLatest session.');

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).toContain('[Mindlore Delta: delta-2026-04-10-0900.md]');
    expect(output).toContain('Latest session');
    expect(output).not.toContain('Old session');
  });

  test('should produce no output when .mindlore/ does not exist', () => {
    const nonExistent = path.join(TEST_DIR, 'no-mindlore');
    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: nonExistent },
    });

    expect(output).toBe('');
  });

  test('should handle missing diary directory gracefully', () => {
    const mindloreDir = path.join(TEST_DIR, '.mindlore');
    fs.mkdirSync(mindloreDir, { recursive: true });
    fs.writeFileSync(
      path.join(mindloreDir, 'INDEX.md'),
      '# Empty Index\n'
    );
    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: mindloreDir },
    });

    expect(output).toContain('[Mindlore INDEX]');
    expect(output).not.toContain('[Mindlore Delta');
  });
});
