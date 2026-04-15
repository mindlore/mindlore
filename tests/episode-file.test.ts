import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-epfile-'));
  fs.mkdirSync(path.join(tmpDir, 'diary'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Run the writeEpisodeFile function in an isolated child process.
 * The function is internal to session-end hook, so we extract and call it directly.
 */
function runWriteEpisodeFile(baseDir: string, project: string, commits: string[], changedFiles: string[], reads: { count: number; repeats: number } | null) {
  // Since writeEpisodeFile is not exported, test via the hook's worker mode
  // by calling the hook with a crafted payload
  const payload = JSON.stringify({ baseDir, project, commits, changedFiles, reads });
  const tmpFile = path.join(os.tmpdir(), `mindlore-test-epfile-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, payload, 'utf8');

  const hookFile = path.join(__dirname, '..', 'hooks', 'mindlore-session-end.cjs');
  // Set MINDLORE_HOME so hookLog writes to our tmpDir
  execSync(`node "${hookFile}" --worker "${tmpFile}"`, {
    timeout: 10000,
    encoding: 'utf8',
    env: { ...process.env, MINDLORE_HOME: tmpDir },
    cwd: process.cwd(),
  });
}

describe('writeEpisodeFile', () => {
  test('creates episode .md file in diary/{project}/', () => {
    runWriteEpisodeFile(tmpDir, 'test-proj', ['abc1234 test commit'], ['file.ts'], { count: 3, repeats: 1 });

    const projDir = path.join(tmpDir, 'diary', 'test-proj');
    expect(fs.existsSync(projDir)).toBe(true);

    const files = fs.readdirSync(projDir).filter(f => f.startsWith('episode-'));
    expect(files.length).toBeGreaterThanOrEqual(1);

    const content = fs.readFileSync(path.join(projDir, files[0]!), 'utf8');
    expect(content).toContain('type: episode');
    expect(content).toContain('project: test-proj');
    expect(content).toContain('abc1234 test commit');
    expect(content).toContain('file.ts');
    expect(content).toContain('3 files read, 1 repeated');
  });

  test('handles empty session (no commits, no files)', () => {
    runWriteEpisodeFile(tmpDir, 'empty-proj', [], [], null);

    const projDir = path.join(tmpDir, 'diary', 'empty-proj');
    const files = fs.readdirSync(projDir).filter(f => f.startsWith('episode-'));
    expect(files.length).toBeGreaterThanOrEqual(1);

    const content = fs.readFileSync(path.join(projDir, files[0]!), 'utf8');
    expect(content).toContain('Read-only session');
    expect(content).not.toContain('## Commits');
  });

  test('is idempotent — second call does not overwrite', () => {
    runWriteEpisodeFile(tmpDir, 'idem-proj', ['aaa commit'], ['x.ts'], null);

    const projDir = path.join(tmpDir, 'diary', 'idem-proj');
    const files1 = fs.readdirSync(projDir).filter(f => f.startsWith('episode-'));

    // Run again within same minute — should not create duplicate
    runWriteEpisodeFile(tmpDir, 'idem-proj', ['bbb different'], ['y.ts'], null);
    const files2 = fs.readdirSync(projDir).filter(f => f.startsWith('episode-'));

    expect(files2.length).toBe(files1.length);
    // Content should still be from first call
    const content = fs.readFileSync(path.join(projDir, files2[0]!), 'utf8');
    expect(content).toContain('aaa commit');
  });

  test('creates project directory recursively', () => {
    const deepBase = path.join(tmpDir, 'deep', 'nested');
    fs.mkdirSync(path.join(deepBase, 'diary'), { recursive: true });
    runWriteEpisodeFile(deepBase, 'nested-proj', ['ccc commit'], [], null);

    expect(fs.existsSync(path.join(deepBase, 'diary', 'nested-proj'))).toBe(true);
  });
});
