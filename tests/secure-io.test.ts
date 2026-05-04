import fs from 'fs';
import os from 'os';
import path from 'path';
import { safeMkdir, safeWriteFile, safeWriteJson } from '../scripts/lib/secure-io.js';

describe('secure-io', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-secio-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('safeMkdir', () => {
    it('creates directory with 0o700 permissions', () => {
      const dir = path.join(tmpDir, 'subdir');
      safeMkdir(dir);
      expect(fs.existsSync(dir)).toBe(true);
      if (process.platform !== 'win32') {
        const mode = fs.statSync(dir).mode & 0o777;
        expect(mode).toBe(0o700);
      }
    });

    it('is idempotent — does not throw on existing dir', () => {
      const dir = path.join(tmpDir, 'subdir');
      safeMkdir(dir);
      expect(() => safeMkdir(dir)).not.toThrow();
    });

    it('creates nested directories', () => {
      const dir = path.join(tmpDir, 'a', 'b', 'c');
      safeMkdir(dir);
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe('safeWriteFile', () => {
    it('writes file with 0o600 permissions', () => {
      const fp = path.join(tmpDir, 'test.txt');
      safeWriteFile(fp, 'hello');
      expect(fs.readFileSync(fp, 'utf8')).toBe('hello');
      if (process.platform !== 'win32') {
        const mode = fs.statSync(fp).mode & 0o777;
        expect(mode).toBe(0o600);
      }
    });

    it('overwrites existing file', () => {
      const fp = path.join(tmpDir, 'test.txt');
      safeWriteFile(fp, 'first');
      safeWriteFile(fp, 'second');
      expect(fs.readFileSync(fp, 'utf8')).toBe('second');
    });
  });

  describe('safeWriteJson', () => {
    it('writes JSON with trailing newline', () => {
      const fp = path.join(tmpDir, 'data.json');
      safeWriteJson(fp, { key: 'value' });
      const content = fs.readFileSync(fp, 'utf8');
      expect(content).toBe('{\n  "key": "value"\n}\n');
    });
  });
});
