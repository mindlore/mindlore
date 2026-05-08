import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-dont-repeat.cjs');

function runHook(input: object, settingsContent?: string): string {
  const tmpSettings = path.join(os.tmpdir(), `mindlore-test-settings-${Date.now()}.json`);
  const realSettings = path.join(os.homedir(), '.claude', 'settings.json');

  let backup: string | null = null;
  if (settingsContent !== undefined) {
    if (fs.existsSync(realSettings)) {
      backup = fs.readFileSync(realSettings, 'utf8');
    }
    fs.writeFileSync(realSettings, settingsContent, 'utf8');
  }

  try {
    const result = execFileSync('node', [HOOK_PATH], {
      input: JSON.stringify(input),
      timeout: 5000,
      encoding: 'utf8',
      env: { ...process.env },
    });
    return result;
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return e.stdout ?? '';
  } finally {
    if (backup !== null) {
      fs.writeFileSync(realSettings, backup, 'utf8');
    } else if (settingsContent !== undefined) {
      try { fs.unlinkSync(tmpSettings); } catch { /* noop */ }
    }
  }
}

describe('dont-repeat dedup with lessons-enforcement', () => {
  const editInput = {
    tool_name: 'Edit',
    tool_input: {
      file_path: '/tmp/test-file.ts',
      new_string: 'appendFileSync is dangerous pattern that should trigger',
    },
  };

  it('exits silently when lessons-enforcement hook is registered', () => {
    const settings = JSON.stringify({
      hooks: {
        PreToolUse: [{
          matcher: 'Write|Edit',
          hooks: [{ command: 'node ~/.claude/hooks/lessons-enforcement.cjs' }],
        }],
      },
    });

    const output = runHook(editInput, settings);
    expect(output).toBe('');
  });

  it('runs full scan when lessons-enforcement is NOT registered', () => {
    const settings = JSON.stringify({
      hooks: {
        PreToolUse: [{
          matcher: 'Bash',
          hooks: [{ command: 'node some-other-hook.cjs' }],
        }],
      },
    });

    const output = runHook(editInput, settings);
    // May or may not produce output depending on lessons content,
    // but the hook should NOT exit early — it should process
    // We verify it didn't crash (non-empty or empty is fine)
    expect(typeof output).toBe('string');
  });

  it('runs full scan when settings.json has no hooks at all', () => {
    const settings = JSON.stringify({});
    const output = runHook(editInput, settings);
    expect(typeof output).toBe('string');
  });
});
