'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { setupTestDir, teardownTestDir } = require('./helpers/db.cjs');

// Test structure: PROJECT_DIR/.mindlore/ (findMindloreDir looks for .mindlore/ in CWD)
const PROJECT_DIR = path.join(__dirname, '..', '.test-project-readguard');
const TEST_DIR = path.join(PROJECT_DIR, '.mindlore');
const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-read-guard.cjs');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['diary']);
  fs.writeFileSync(path.join(TEST_DIR, 'INDEX.md'), '# Index\n', 'utf8');
  // Create a dummy file in the project dir to read
  fs.writeFileSync(path.join(PROJECT_DIR, 'README.md'), '# Test\n', 'utf8');
});

afterEach(() => {
  teardownTestDir(PROJECT_DIR);
});

function runGuard(input) {
  try {
    const result = execSync(`node "${HOOK_PATH}"`, {
      input,
      encoding: 'utf8',
      timeout: 5000,
      cwd: PROJECT_DIR,
      env: { ...process.env },
    });
    return { stdout: result.trim(), exitCode: 0 };
  } catch (err) {
    return { stdout: (err.stdout || '').trim(), stderr: (err.stderr || '').trim(), exitCode: err.status || 0 };
  }
}

describe('Read Guard Hook', () => {
  test('should not warn on first read', () => {
    const input = JSON.stringify({ file_path: path.join(PROJECT_DIR, 'README.md') });
    const { stdout } = runGuard(input);
    expect(stdout).toBe('');
  });

  test('should create _session-reads.json on first read', () => {
    const input = JSON.stringify({ file_path: path.join(PROJECT_DIR, 'README.md') });
    runGuard(input);
    const readsPath = path.join(TEST_DIR, 'diary', '_session-reads.json');
    expect(fs.existsSync(readsPath)).toBe(true);
  });

  test('should skip files inside .mindlore/', () => {
    const input = JSON.stringify({ file_path: path.join(TEST_DIR, 'INDEX.md') });
    runGuard(input);
    const readsPath = path.join(TEST_DIR, 'diary', '_session-reads.json');
    if (fs.existsSync(readsPath)) {
      const reads = JSON.parse(fs.readFileSync(readsPath, 'utf8'));
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
