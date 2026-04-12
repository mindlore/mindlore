import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { setupTestDir, teardownTestDir } from './helpers/db.js';

const PROJECT_DIR = path.join(__dirname, '..', '.test-project-decision');
const MINDLORE_DIR = path.join(PROJECT_DIR, '.mindlore');
const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-decision-detector.cjs');

beforeEach(() => {
  setupTestDir(MINDLORE_DIR, ['decisions', 'diary']);
  fs.writeFileSync(path.join(MINDLORE_DIR, 'INDEX.md'), '# Index\n', 'utf8');
});

afterEach(() => {
  teardownTestDir(PROJECT_DIR);
});

function runDetector(input: string): string {
  try {
    const result = execSync(`node "${HOOK_PATH}"`, {
      input,
      encoding: 'utf8',
      timeout: 5000,
      cwd: PROJECT_DIR,
      env: { ...process.env, MINDLORE_HOME: MINDLORE_DIR },
    });
    return result.trim();
  } catch (err) {
    const e = err as { stdout?: string };
    return (e.stdout ?? '').trim();
  }
}

describe('Decision Detector Hook', () => {
  test('should detect Turkish decision signal', () => {
    const output = runDetector('FTS5 kullanmaya karar verdik, vector search ertelenecek');
    expect(output).toContain('Karar sinyali');
    expect(output).toContain('karar verdik');
  });

  test('should detect English decision signal', () => {
    const output = runDetector('We decided to use SQLite instead of PostgreSQL');
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
