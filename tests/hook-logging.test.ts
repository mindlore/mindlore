import fs from 'fs';
import path from 'path';
import os from 'os';

const { hookLog, getRecentHookErrors } = require('../hooks/lib/mindlore-common.cjs');

let tmpDir: string;
let origEnv: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-hooklog-'));
  fs.mkdirSync(path.join(tmpDir, 'diary'), { recursive: true });
  origEnv = process.env.MINDLORE_HOME;
  process.env.MINDLORE_HOME = tmpDir;
});

afterEach(() => {
  if (origEnv === undefined) delete process.env.MINDLORE_HOME;
  else process.env.MINDLORE_HOME = origEnv;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('hookLog', () => {
  test('writes JSONL entry to diary/_hook-log.jsonl', () => {
    hookLog('test-hook', 'info', 'hello world');

    const logPath = path.join(tmpDir, 'diary', '_hook-log.jsonl');
    expect(fs.existsSync(logPath)).toBe(true);

    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]!);
    expect(entry.hook).toBe('test-hook');
    expect(entry.level).toBe('info');
    expect(entry.msg).toBe('hello world');
    expect(entry.ts).toBeDefined();
    expect(entry.pid).toBe(process.pid);
  });

  test('appends multiple entries', () => {
    hookLog('h1', 'info', 'first');
    hookLog('h2', 'warn', 'second');
    hookLog('h3', 'error', 'third');

    const logPath = path.join(tmpDir, 'diary', '_hook-log.jsonl');
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1]!).level).toBe('warn');
  });

  test('rotates when file exceeds 500KB', () => {
    const logPath = path.join(tmpDir, 'diary', '_hook-log.jsonl');
    // Write >500KB of data
    const bigLine = JSON.stringify({ ts: new Date().toISOString(), hook: 'filler', level: 'info', msg: 'x'.repeat(200), pid: 1 });
    const lines = Array(3000).fill(bigLine);
    fs.writeFileSync(logPath, lines.join('\n') + '\n');
    expect(fs.statSync(logPath).size).toBeGreaterThan(512 * 1024);

    // hookLog should trigger rotation
    hookLog('post-rotate', 'info', 'after rotation');

    const content = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    // Should be trimmed to ~501 lines (500 kept + 1 new)
    expect(content.length).toBeLessThanOrEqual(501);
    expect(JSON.parse(content[content.length - 1]!).hook).toBe('post-rotate');
  });

  test('does not crash when diary dir missing', () => {
    fs.rmSync(path.join(tmpDir, 'diary'), { recursive: true, force: true });
    expect(() => hookLog('no-dir', 'error', 'should not crash')).not.toThrow();
  });
});

describe('getRecentHookErrors', () => {
  test('returns empty when no log file', () => {
    const errors = getRecentHookErrors();
    expect(errors).toEqual([]);
  });

  test('returns only error and warn entries', () => {
    hookLog('h1', 'info', 'ignored');
    hookLog('h2', 'error', 'caught');
    hookLog('h3', 'warn', 'also caught');
    hookLog('h4', 'info', 'also ignored');

    const errors = getRecentHookErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0].level).toBe('error');
    expect(errors[1].level).toBe('warn');
  });

  test('respects since cutoff', () => {
    const logPath = path.join(tmpDir, 'diary', '_hook-log.jsonl');
    // Write an old error
    const oldEntry = JSON.stringify({ ts: '2020-01-01T00:00:00.000Z', hook: 'old', level: 'error', msg: 'ancient', pid: 1 });
    fs.writeFileSync(logPath, oldEntry + '\n');
    // Write a recent error
    hookLog('new', 'error', 'recent');

    const errors = getRecentHookErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].hook).toBe('new');
  });

  test('respects limit parameter', () => {
    for (let i = 0; i < 20; i++) {
      hookLog(`h${i}`, 'error', `err ${i}`);
    }
    const errors = getRecentHookErrors(undefined, 5);
    expect(errors).toHaveLength(5);
  });

  test('returns chronological order', () => {
    hookLog('first', 'error', 'a');
    hookLog('second', 'error', 'b');

    const errors = getRecentHookErrors();
    expect(errors[0].hook).toBe('first');
    expect(errors[1].hook).toBe('second');
  });
});
