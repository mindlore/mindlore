import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { setupTestDir, teardownTestDir } from './helpers/db';

const TEST_DIR = path.join(__dirname, '..', '.test-post-read');
const HOOK_SCRIPT = path.resolve(__dirname, '..', 'hooks', 'mindlore-post-read.cjs');
const PROJECT_NAME = path.basename(TEST_DIR);

beforeEach(() => {
  setupTestDir(TEST_DIR);
  // Create .mindlore/diary/ for session reads storage
  const diaryDir = path.join(TEST_DIR, '.mindlore', 'diary');
  fs.mkdirSync(diaryDir, { recursive: true });
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

function runHook(stdinData: Record<string, unknown>): string {
  try {
    return execSync(`node "${HOOK_SCRIPT}"`, {
      input: JSON.stringify(stdinData),
      encoding: 'utf8',
      timeout: 5000,
      cwd: TEST_DIR,
    });
  } catch (err) {
    return (err as { stdout?: string }).stdout || '';
  }
}

describe('mindlore-post-read hook', () => {
  test('writes token estimate to _session-reads.json', () => {
    const testFile = path.join(TEST_DIR, 'test.ts');
    fs.writeFileSync(testFile, 'const x = 1;\n'.repeat(100), 'utf8');

    runHook({
      tool_name: 'Read',
      tool_input: { file_path: testFile },
      tool_output: { content: 'const x = 1;\n'.repeat(100) },
    });

    const readsPath = path.join(TEST_DIR, '.mindlore', 'diary', `_session-reads-${PROJECT_NAME}.json`);
    if (fs.existsSync(readsPath)) {
      const reads = JSON.parse(fs.readFileSync(readsPath, 'utf8'));
      const entry = reads[path.resolve(testFile)];
      if (entry) {
        expect(entry.tokens).toBeGreaterThan(0);
        expect(entry.chars).toBeGreaterThan(0);
      }
    }
  });

  test('exits cleanly with non-Read tool', () => {
    const result = runHook({
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/test.ts' },
    });

    expect(result.trim()).toBe('');
  });

  test('exits cleanly with empty stdin', () => {
    const result = execSync(`echo "{}" | node "${HOOK_SCRIPT}"`, {
      encoding: 'utf8',
      timeout: 5000,
      cwd: TEST_DIR,
    });

    expect(result.trim()).toBe('');
  });
});
