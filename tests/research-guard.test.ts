import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDb, insertFts } from './helpers/db';

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-research-guard.cjs');

let tmpDir: string;
let dbPath: string;

beforeAll(() => {
  // Create isolated .mindlore/ with test DB
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-rg-'));
  dbPath = path.join(tmpDir, 'mindlore.db');
  const db = createTestDb(dbPath);

  // Insert a high-quality recent source
  insertFts(db, {
    path: 'sources/cc-hooks-reference.md',
    slug: 'cc-hooks-reference',
    description: 'Claude Code Hooks Reference',
    type: 'source',
    category: 'sources',
    title: 'Claude Code Hooks — Comprehensive Reference',
    content: 'Claude Code hooks SessionEnd timeout behavior exit code PreToolUse PostToolUse lifecycle',
    tags: 'claude-code, hooks, timeout, SessionEnd',
    quality: 'high',
    dateCaptured: new Date().toISOString().slice(0, 10),
    project: 'mindlore',
  });

  // Insert a medium-quality source
  insertFts(db, {
    path: 'sources/obsidian-integration.md',
    slug: 'obsidian-integration',
    description: 'Obsidian integration notes',
    type: 'source',
    category: 'sources',
    title: 'Obsidian Vault Integration',
    content: 'obsidian vault wikilinks export integration markdown',
    tags: 'obsidian, vault, export',
    quality: 'medium',
    dateCaptured: new Date().toISOString().slice(0, 10),
    project: 'mindlore',
  });

  db.close();
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runHook(input: Record<string, unknown>): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, MINDLORE_HOME: tmpDir },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 1,
  };
}

describe('mindlore-research-guard', () => {
  test('should pass silently for non-Agent tools', () => {
    const result = runHook({ tool_name: 'Read', tool_input: { file_path: '/tmp/test.md' } });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  test('should pass silently for non-research Agent prompts', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: { prompt: 'Fix the bug in auth module', description: 'coder fix' },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  test('should pass silently for mindlore ingest operations', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: { prompt: '[mindlore:ingest] Fetch URL and save to raw/', description: 'ingest' },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  test('should pass silently for [research-override] bypass', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: '[research-override] Research the Claude Code hooks timeout',
        description: 'research',
      },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  test('should block (exit 2) when high-quality recent match exists', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: 'Research the Claude Code SessionEnd hook timeout behavior',
        description: 'SessionEnd hook research',
      },
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('BLOK');
    expect(result.stderr).toContain('cc-hooks-reference');
  });

  test('should pass silently when keywords are too few', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: { prompt: 'Research it', description: 'research' },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  test('should return additionalContext for medium-quality matches', () => {
    const result = runHook({
      tool_name: 'Agent',
      tool_input: {
        prompt: 'Research obsidian vault integration wikilinks export',
        description: 'obsidian research',
      },
    });
    expect(result.exitCode).toBe(0);
    if (result.stdout) {
      const parsed = JSON.parse(result.stdout);
      expect(parsed.hookSpecificOutput).toBeDefined();
      expect(parsed.hookSpecificOutput.additionalContext).toContain('mindlore-research-guard');
    }
  });

  test('should handle empty stdin gracefully', () => {
    const result = spawnSync('node', [HOOK_PATH], {
      input: '',
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: tmpDir },
    });
    expect(result.status).toBe(0);
  });
});
