import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDb, insertFts } from './helpers/db';

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-research-guard.cjs');

let tmpDir: string;
let dbPath: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-rgs-'));
  dbPath = path.join(tmpDir, 'mindlore.db');
  const db = createTestDb(dbPath);

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

describe('research-guard agent type filtering', () => {
  describe('source-level checks', () => {
    it('should reference subagent_type in hook source', () => {
      const hookSource = fs.readFileSync(HOOK_PATH, 'utf8');
      expect(hookSource).toMatch(/subagent_type/);
    });

    it('should have allowlist for research-type agents', () => {
      const hookSource = fs.readFileSync(HOOK_PATH, 'utf8');
      expect(hookSource).toMatch(/researcher/);
      expect(hookSource).toMatch(/Explore/);
    });

    it('should have early-return logic for non-research agents', () => {
      const hookSource = fs.readFileSync(HOOK_PATH, 'utf8');
      expect(hookSource).toContain('return');
    });
  });

  describe('behavioral: non-research agents pass through', () => {
    it('should NOT block coder agent even with research-matching prompt', () => {
      const result = runHook({
        tool_name: 'Agent',
        tool_input: {
          subagent_type: 'coder',
          prompt: 'Research the Claude Code SessionEnd hook timeout behavior',
          description: 'research hooks',
        },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
    });

    it('should NOT block code-reviewer agent', () => {
      const result = runHook({
        tool_name: 'Agent',
        tool_input: {
          subagent_type: 'code-reviewer',
          prompt: 'Research and review the Claude Code hooks implementation',
          description: 'review hooks',
        },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
    });

    it('should NOT block general-purpose agent', () => {
      const result = runHook({
        tool_name: 'Agent',
        tool_input: {
          subagent_type: 'general-purpose',
          prompt: 'Research the Claude Code SessionEnd hook timeout behavior',
          description: 'research hooks',
        },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
    });
  });

  describe('behavioral: research agents are still guarded', () => {
    it('should block researcher agent with matching high-quality knowledge', () => {
      const result = runHook({
        tool_name: 'Agent',
        tool_input: {
          subagent_type: 'researcher',
          prompt: 'Research the Claude Code SessionEnd hook timeout behavior',
          description: 'research hooks',
        },
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('BLOK');
    });

    it('should block Explore agent with matching high-quality knowledge', () => {
      const result = runHook({
        tool_name: 'Agent',
        tool_input: {
          subagent_type: 'Explore',
          prompt: 'Explore the Claude Code SessionEnd hook timeout behavior',
          description: 'explore hooks',
        },
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('BLOK');
    });
  });

  describe('behavioral: no subagent_type — description-based filtering', () => {
    it('should guard agents with research description and no subagent_type', () => {
      const result = runHook({
        tool_name: 'Agent',
        tool_input: {
          prompt: 'Research the Claude Code SessionEnd hook timeout behavior',
          description: 'research hooks',
        },
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('BLOK');
    });

    it('should pass agents with non-research description and no subagent_type', () => {
      const result = runHook({
        tool_name: 'Agent',
        tool_input: {
          prompt: 'Fix the auth module bug in Claude Code hooks timeout',
          description: 'fix auth bug',
        },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
    });
  });
});
