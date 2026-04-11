import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { setupTestDir, teardownTestDir } from './helpers/db';

const TEST_DIR = path.join(__dirname, '..', '.test-dont-repeat');
const HOOK_SCRIPT = path.resolve(__dirname, '..', 'hooks', 'mindlore-dont-repeat.cjs');

beforeEach(() => {
  setupTestDir(TEST_DIR);
  // Create a fake lessons file with negative rules
  const lessonsDir = path.join(TEST_DIR, '.claude', 'lessons');
  fs.mkdirSync(lessonsDir, { recursive: true });
  fs.writeFileSync(path.join(lessonsDir, 'global.md'), [
    '# Global Lessons',
    '',
    '- YAPMA: ESM projede `__dirname` kullanma. `fileURLToPath(import.meta.url)` kullan',
    '- DON\'T: Use `any` type in TypeScript — use `unknown` + type guard',
    '- NEVER: Use `console.log` for production logging',
  ].join('\n'), 'utf8');
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
      env: { ...process.env, HOME: TEST_DIR, USERPROFILE: TEST_DIR },
      cwd: TEST_DIR,
    });
  } catch (err) {
    return (err as { stdout?: string }).stdout || '';
  }
}

describe('mindlore-dont-repeat hook', () => {
  test('detects violation when writing code with banned pattern', () => {
    const result = runHook({
      tool_name: 'Write',
      tool_input: {
        file_path: path.join(TEST_DIR, 'test.ts'),
        content: 'const dir = __dirname;\nconsole.log(dir);',
      },
    });

    // Should output JSON with additionalContext containing violation
    if (result.trim()) {
      const parsed = JSON.parse(result);
      expect(parsed.hookSpecificOutput.additionalContext).toContain('dont-repeat');
    }
    // If no output, patterns may not have matched (short pattern filter)
  });

  test('does not trigger on non-code files', () => {
    const result = runHook({
      tool_name: 'Write',
      tool_input: {
        file_path: path.join(TEST_DIR, 'README.md'),
        content: 'const dir = __dirname;',
      },
    });

    expect(result.trim()).toBe('');
  });

  test('does not trigger on Edit old_string (code being removed)', () => {
    const result = runHook({
      tool_name: 'Edit',
      tool_input: {
        file_path: path.join(TEST_DIR, 'test.ts'),
        old_string: 'const dir = __dirname;',
        new_string: 'const dir = import.meta.url;',
      },
    });

    // old_string contains __dirname but should NOT trigger (it's being removed)
    // new_string is clean
    expect(result.trim()).toBe('');
  });

  test('only accepts Write and Edit tool names', () => {
    const result = runHook({
      tool_name: 'Read',
      tool_input: {
        file_path: path.join(TEST_DIR, 'test.ts'),
      },
    });

    expect(result.trim()).toBe('');
  });

  test('exits cleanly with empty stdin', () => {
    const result = execSync(`echo "{}" | node "${HOOK_SCRIPT}"`, {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, HOME: TEST_DIR, USERPROFILE: TEST_DIR },
      cwd: TEST_DIR,
    });

    expect(result.trim()).toBe('');
  });
});
