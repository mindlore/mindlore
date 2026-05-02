import fs from 'fs';
import os from 'os';
import path from 'path';

const common = require('../hooks/lib/mindlore-common.cjs');

describe('SEC-13: baseDir resolution with path.sep guard', () => {
  const MINDLORE_DIR = common.MINDLORE_DIR; // '.mindlore'

  function extractBaseDir(filePath: string): string | null {
    const resolved = path.resolve(filePath);
    const sepDir = path.sep + MINDLORE_DIR;
    let idx = resolved.lastIndexOf(sepDir + path.sep);
    if (idx === -1 && resolved.endsWith(sepDir)) {
      idx = resolved.length - sepDir.length;
    }
    if (idx === -1) return null;
    return resolved.slice(0, idx + sepDir.length);
  }

  it('extracts baseDir from valid .mindlore path', () => {
    const p = path.join('C:', 'Users', 'test', '.mindlore', 'sources', 'x.md');
    const result = extractBaseDir(p);
    expect(result).not.toBeNull();
    expect(result!.endsWith(MINDLORE_DIR)).toBe(true);
  });

  it('rejects .mindlore-backup (partial match)', () => {
    const p = path.join('C:', 'Users', 'test', '.mindlore-backup', 'foo.md');
    const result = extractBaseDir(p);
    expect(result).toBeNull();
  });

  it('rejects .mindlore-old (partial match)', () => {
    const p = path.join('C:', 'Users', 'test', '.mindlore-old', 'sources', 'x.md');
    const result = extractBaseDir(p);
    expect(result).toBeNull();
  });

  it('handles nested .mindlore with lastIndexOf', () => {
    const p = path.join('C:', 'Users', '.mindlore', 'projects', '.mindlore', 'sources', 'x.md');
    const result = extractBaseDir(p);
    expect(result).not.toBeNull();
    const parts = result!.split(path.sep);
    const mindloreCount = parts.filter(seg => seg === MINDLORE_DIR).length;
    expect(mindloreCount).toBe(2);
  });

  it('returns null for path without .mindlore', () => {
    const p = path.join('C:', 'Users', 'test', 'Documents', 'file.md');
    expect(extractBaseDir(p)).toBeNull();
  });
});

describe('SEC-12: _rotateFile atomic write', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec12-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rotates file exceeding maxBytes and leaves no .tmp', () => {
    const filePath = path.join(tmpDir, 'test.log');
    const lines = Array.from({ length: 100 }, (_, i) => `line-${i}`);
    fs.writeFileSync(filePath, lines.join('\n') + '\n');

    const keepLines = 10;
    common._rotateFile(filePath, 50, keepLines);

    const content = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(content.length).toBe(keepLines);
    expect(content[content.length - 1]).toBe('line-99');
    expect(fs.existsSync(filePath + '.tmp')).toBe(false);
  });

  it('does not rotate file under maxBytes', () => {
    const filePath = path.join(tmpDir, 'small.log');
    fs.writeFileSync(filePath, 'small content\n');
    const before = fs.readFileSync(filePath, 'utf8');

    common._rotateFile(filePath, 999999, 10);

    expect(fs.readFileSync(filePath, 'utf8')).toBe(before);
  });

  it('handles non-existent file gracefully', () => {
    const filePath = path.join(tmpDir, 'does-not-exist.log');
    expect(() => common._rotateFile(filePath, 50, 10)).not.toThrow();
  });
});

describe('SEC-9: isDaemonRunning TOCTOU-safe', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec9-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns running:false when PID file does not exist', () => {
    const pidFile = path.join(tmpDir, 'nonexistent.pid');
    const result = common.isDaemonRunning(pidFile);
    expect(result).toEqual({ running: false });
  });

  it('returns running:false for corrupt/NaN PID content', () => {
    const pidFile = path.join(tmpDir, 'bad.pid');
    fs.writeFileSync(pidFile, 'not-a-number\n');
    const result = common.isDaemonRunning(pidFile);
    expect(result.running).toBe(false);
  });

  it('returns running:false for stale PID and cleans up file', () => {
    const pidFile = path.join(tmpDir, 'stale.pid');
    fs.writeFileSync(pidFile, '999999999\n');
    const result = common.isDaemonRunning(pidFile);
    expect(result.running).toBe(false);
    expect(fs.existsSync(pidFile)).toBe(false);
  });

  it('returns running:true for live PID (current process)', () => {
    const pidFile = path.join(tmpDir, 'live.pid');
    fs.writeFileSync(pidFile, `${process.pid}\n`);
    const result = common.isDaemonRunning(pidFile);
    expect(result).toEqual({ running: true, pid: process.pid });
    fs.unlinkSync(pidFile);
  });
});
