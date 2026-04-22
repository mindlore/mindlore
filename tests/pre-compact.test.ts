import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { getExecStdout } from './helpers/exec.js';

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-pre-compact.cjs');

function runHook(cwd: string): string {
  try {
    return execFileSync('node', [HOOK_PATH], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, NODE_ENV: 'test', MINDLORE_HOME: path.join(cwd, '.mindlore') },
      cwd,
    });
  } catch (err: unknown) {
    return getExecStdout(err);
  }
}

describe('mindlore-pre-compact hook', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(__dirname, `.test-pre-compact-${Date.now()}`);
    const mindloreDir = path.join(testDir, '.mindlore');
    fs.mkdirSync(path.join(mindloreDir, 'diary'), { recursive: true });
    fs.mkdirSync(path.join(mindloreDir, 'episodes'), { recursive: true });
    fs.writeFileSync(path.join(mindloreDir, 'log.md'), '');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should write pre-compact episode to episodes/', () => {
    runHook(testDir);
    const episodesDir = path.join(testDir, '.mindlore', 'episodes');
    const episodes = fs.readdirSync(episodesDir).filter(f => f.includes('pre-compact'));
    expect(episodes.length).toBeGreaterThanOrEqual(1);
  });

  test('should output flush message', () => {
    const output = runHook(testDir);
    expect(output).toContain('pre-compact');
  });
});
