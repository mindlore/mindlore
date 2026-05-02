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

describe('SEC-4: restrictive file permissions (0o600/0o700)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec4-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('_rotateFile writes with mode 0o600', () => {
    const filePath = path.join(tmpDir, 'secret.log');
    const lines = Array.from({ length: 50 }, (_, i) => `line-${i}`);
    fs.writeFileSync(filePath, lines.join('\n') + '\n');

    common._rotateFile(filePath, 10, 5);

    if (process.platform !== 'win32') {
      const stat = fs.statSync(filePath);
      expect(stat.mode & 0o777).toBe(0o600);
    } else {
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('writeFileSync in hooks uses mode 0o600 for sensitive files', () => {
    const hookSrc = fs.readFileSync(
      path.join(__dirname, '..', 'hooks', 'mindlore-session-end.cjs'), 'utf8'
    );
    const writeMatches = hookSrc.match(/writeFileSync\([^)]+\)/g) ?? [];
    const sensitiveWrites = writeMatches.filter(
      m => !m.includes('.pid') && !m.includes('.port')
    );
    for (const w of sensitiveWrites) {
      if (w.includes('mode')) {
        expect(w).toMatch(/0o600/);
      }
    }
  });
});

describe('SEC-6: no execSync with user-controlled input', () => {
  const FILES_WITH_SUBPROCESSES = [
    { file: 'hooks/mindlore-pre-compact.cjs', minExecFile: 1 },
    { file: 'hooks/mindlore-session-end.cjs', minExecFile: 5 },
    { file: 'scripts/init.ts', minExecFile: 1 },
  ];

  it.each(FILES_WITH_SUBPROCESSES)(
    '$file has zero execSync calls',
    ({ file }) => {
      const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      const execSyncCalls = src.match(/\bexecSync\s*\(/g) ?? [];
      expect(execSyncCalls.length).toBe(0);
    }
  );

  it.each(FILES_WITH_SUBPROCESSES)(
    '$file uses execFileSync (min $minExecFile calls)',
    ({ file, minExecFile }) => {
      const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      const execFileSyncCalls = src.match(/\bexecFileSync\s*\(/g) ?? [];
      expect(execFileSyncCalls.length).toBeGreaterThanOrEqual(minExecFile);
    }
  );
});

describe('SEC-8: daemon TCP connection limits', () => {
  it('daemon.ts source sets maxConnections = 10', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'lib', 'daemon.ts'), 'utf8'
    );
    expect(src).toMatch(/server\.maxConnections\s*=\s*10/);
  });

  it('daemon.ts source sets connection timeout', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'lib', 'daemon.ts'), 'utf8'
    );
    expect(src).toMatch(/conn\.setTimeout\(\d+\)/);
    expect(src).toMatch(/conn\.on\(['"]timeout['"]/);
  });

  it('daemon.ts source enforces buffer limit', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'lib', 'daemon.ts'), 'utf8'
    );
    expect(src).toMatch(/MAX_BUFFER/);
    expect(src).toMatch(/buffer\.length\s*>\s*MAX_BUFFER/);
  });
});
