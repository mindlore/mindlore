import { validatePath, validateUrl, sanitizeForExecFile, escapeYamlValue } from '../scripts/lib/input-validation.js';
import os from 'os';
import path from 'path';

describe('validatePath', () => {
  const homeDir = os.homedir();
  const allowedBase = path.join(homeDir, '.mindlore');

  it('accepts path under allowed base', () => {
    expect(() => validatePath(path.join(allowedBase, 'raw'), allowedBase)).not.toThrow();
  });

  it('accepts exact allowed base', () => {
    expect(() => validatePath(allowedBase, allowedBase)).not.toThrow();
  });

  it('rejects path traversal with ..', () => {
    expect(() => validatePath(path.join(allowedBase, '..', 'etc'), allowedBase)).toThrow(/must be under/);
  });

  it('rejects absolute path outside base', () => {
    expect(() => validatePath('/etc/passwd', allowedBase)).toThrow(/must be under/);
  });

  it('rejects path with .. embedded', () => {
    expect(() => validatePath(path.join(allowedBase, 'raw', '..', '..', 'etc'), allowedBase)).toThrow(/must be under/);
  });
});

describe('validateUrl', () => {
  it('accepts public URL', () => {
    expect(() => validateUrl('https://example.com')).not.toThrow();
  });

  it('rejects localhost', () => {
    expect(() => validateUrl('http://127.0.0.1/api')).toThrow(/private/i);
  });

  it('rejects 10.x.x.x range', () => {
    expect(() => validateUrl('http://10.0.0.1/secret')).toThrow(/private/i);
  });

  it('rejects 192.168.x.x range', () => {
    expect(() => validateUrl('http://192.168.1.1/admin')).toThrow(/private/i);
  });

  it('rejects 169.254.x.x link-local', () => {
    expect(() => validateUrl('http://169.254.169.254/metadata')).toThrow(/private/i);
  });

  it('rejects 0.0.0.0', () => {
    expect(() => validateUrl('http://0.0.0.0/')).toThrow(/private/i);
  });

  it('rejects 172.16-31.x range', () => {
    expect(() => validateUrl('http://172.16.0.1/')).toThrow(/private/i);
    expect(() => validateUrl('http://172.31.255.255/')).toThrow(/private/i);
  });

  it('rejects fc00: IPv6', () => {
    expect(() => validateUrl('http://[fc00::1]/')).toThrow(/private/i);
  });

  it('rejects fe80: link-local IPv6', () => {
    expect(() => validateUrl('http://[fe80::1]/')).toThrow(/private/i);
  });

  it('rejects ::1 loopback IPv6', () => {
    expect(() => validateUrl('http://[::1]/')).toThrow(/private/i);
  });

  it('rejects localhost hostname', () => {
    expect(() => validateUrl('http://localhost/admin')).toThrow(/private/i);
  });

  it('accepts github.com', () => {
    expect(() => validateUrl('https://github.com/user/repo')).not.toThrow();
  });
});

describe('sanitizeForExecFile', () => {
  it('accepts alphanumeric with hyphens and dots', () => {
    expect(sanitizeForExecFile('my-repo.js')).toBe('my-repo.js');
  });

  it('rejects semicolons', () => {
    expect(() => sanitizeForExecFile('foo;whoami')).toThrow(/invalid/i);
  });

  it('rejects backticks', () => {
    expect(() => sanitizeForExecFile('foo`id`')).toThrow(/invalid/i);
  });

  it('rejects pipe', () => {
    expect(() => sanitizeForExecFile('foo|cat /etc/passwd')).toThrow(/invalid/i);
  });

  it('rejects $() subshell', () => {
    expect(() => sanitizeForExecFile('$(whoami)')).toThrow(/invalid/i);
  });

  it('accepts valid GitHub owner/repo names', () => {
    expect(sanitizeForExecFile('anthropics')).toBe('anthropics');
    expect(sanitizeForExecFile('claude-code')).toBe('claude-code');
    expect(sanitizeForExecFile('my_repo.v2')).toBe('my_repo.v2');
  });
});

describe('escapeYamlValue', () => {
  it('escapes double quotes', () => {
    expect(escapeYamlValue('hello "world"')).not.toContain('"world"');
  });

  it('escapes newlines', () => {
    const result = escapeYamlValue('line1\nline2');
    expect(result).not.toContain('\n');
  });

  it('escapes carriage returns', () => {
    const result = escapeYamlValue('line1\rline2');
    expect(result).not.toContain('\r');
  });

  it('handles colons safely', () => {
    const result = escapeYamlValue('key: value');
    expect(result).toBe('"key: value"');
  });

  it('returns plain string for safe values', () => {
    expect(escapeYamlValue('simple title')).toBe('"simple title"');
  });

  it('escapes backslashes', () => {
    const result = escapeYamlValue('path\\to\\file');
    expect(result).toContain('\\\\');
  });
});
