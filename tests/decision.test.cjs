'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { setupTestDir, teardownTestDir } = require('./helpers/db.cjs');

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-decision');
const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-decision-detector.cjs');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['decisions', 'diary']);
  // Create minimal INDEX.md so findMindloreDir can work
  fs.writeFileSync(path.join(TEST_DIR, 'INDEX.md'), '# Index\n', 'utf8');
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

function runDetector(input, cwd) {
  try {
    const result = execSync(`node "${HOOK_PATH}"`, {
      input,
      encoding: 'utf8',
      timeout: 5000,
      cwd: cwd || path.join(TEST_DIR, '..'),
      env: { ...process.env },
    });
    return result.trim();
  } catch (err) {
    return (err.stdout || '').trim();
  }
}

describe('Decision Detector Hook', () => {
  test('should detect Turkish decision signal', () => {
    const output = runDetector('FTS5 kullanmaya karar verdik, vector search ertelenecek');
    expect(output).toContain('Karar sinyali');
    expect(output).toContain('karar verdik');
  });

  test('should detect English decision signal', () => {
    const output = runDetector("We decided to use SQLite instead of PostgreSQL");
    expect(output).toContain('Karar sinyali');
    expect(output).toContain('decided');
  });

  test('should not trigger on normal text', () => {
    const output = runDetector('Bu dosyayı oku ve bana özetle');
    expect(output).toBe('');
  });

  test('should not trigger on short input', () => {
    const output = runDetector('merhaba');
    expect(output).toBe('');
  });

  test('should handle JSON input format', () => {
    const input = JSON.stringify({ prompt: "Let's go with option B for the API design" });
    const output = runDetector(input);
    expect(output).toContain('Karar sinyali');
  });
});
