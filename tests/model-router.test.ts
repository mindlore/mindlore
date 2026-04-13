import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getExecStdout } from './helpers/exec.js';

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-model-router.cjs');
const TEST_DIR = path.join(__dirname, '..', '.test-model-router');

function runHook(stdinData: Record<string, unknown>, mindloreDir?: string): string {
  const mDir = mindloreDir || path.join(TEST_DIR, '.mindlore');
  const cwd = mindloreDir ? path.dirname(mindloreDir) : TEST_DIR;
  const input = JSON.stringify(stdinData);
  try {
    return execSync(`node "${HOOK_PATH}"`, {
      cwd,
      input,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: mDir },
    });
  } catch (err: unknown) {
    return getExecStdout(err);
  }
}

beforeEach(() => {
  fs.mkdirSync(path.join(TEST_DIR, '.mindlore'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('mindlore-model-router', () => {
  test('should detect [mindlore:ingest] marker and set haiku', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: '[mindlore:ingest] Fetch and summarize this URL',
        description: 'mindlore ingest',
        subagent_type: 'researcher',
      },
    });

    expect(result).toBeTruthy();
    const parsed = JSON.parse(result);
    expect(parsed.hookSpecificOutput.updatedInput.model).toBe('haiku');
    // Preserve existing fields
    expect(parsed.hookSpecificOutput.updatedInput.prompt).toContain('[mindlore:ingest]');
    expect(parsed.hookSpecificOutput.updatedInput.subagent_type).toBe('researcher');
  });

  test('should detect [mindlore:evolve] marker and set sonnet', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: '[mindlore:evolve] Analyze knowledge base for co-evolution',
        description: 'mindlore evolve',
      },
    });

    const parsed = JSON.parse(result);
    expect(parsed.hookSpecificOutput.updatedInput.model).toBe('sonnet');
  });

  test('should detect [mindlore:explore] marker and set sonnet', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: '[mindlore:explore] Find unexpected connections',
        description: 'mindlore explore',
      },
    });

    const parsed = JSON.parse(result);
    expect(parsed.hookSpecificOutput.updatedInput.model).toBe('sonnet');
  });

  test('should output nothing when no marker present', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: 'Research best practices for authentication',
        description: 'auth research',
      },
    });

    expect(result.trim()).toBe('');
  });

  test('should output nothing when tool is not Agent', () => {
    const result = runHook({
      tool_name: 'Read',
      tool_input: { file_path: '/some/file.md' },
    });

    expect(result.trim()).toBe('');
  });

  test('should output nothing when .mindlore/ does not exist', () => {
    // Remove .mindlore so hook finds nothing
    fs.rmSync(path.join(TEST_DIR, '.mindlore'), { recursive: true, force: true });

    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: '[mindlore:ingest] URL fetch',
        description: 'mindlore ingest',
      },
    });

    expect(result.trim()).toBe('');
  });

  test('should use config.json model override', () => {
    // User overrides ingest to sonnet
    const configPath = path.join(TEST_DIR, '.mindlore', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      models: { ingest: 'sonnet', default: 'haiku' },
    }), 'utf8');

    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: '[mindlore:ingest] Fetch URL',
        description: 'mindlore ingest',
      },
    });

    const parsed = JSON.parse(result);
    expect(parsed.hookSpecificOutput.updatedInput.model).toBe('sonnet');
  });

  test('should fall back to config default when skill key missing', () => {
    const configPath = path.join(TEST_DIR, '.mindlore', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      models: { default: 'sonnet' },
    }), 'utf8');

    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: '[mindlore:ingest] Fetch URL',
        description: 'mindlore ingest',
      },
    });

    const parsed = JSON.parse(result);
    expect(parsed.hookSpecificOutput.updatedInput.model).toBe('sonnet');
  });

  test('should fall back to hardcoded defaults when config.json missing', () => {
    // No config.json, just .mindlore/ dir
    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: '[mindlore:evolve] Analyze KB',
        description: 'mindlore evolve',
      },
    });

    const parsed = JSON.parse(result);
    expect(parsed.hookSpecificOutput.updatedInput.model).toBe('sonnet');
  });
});
