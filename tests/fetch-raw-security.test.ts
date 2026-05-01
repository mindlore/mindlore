import { sanitizeForExecFile, validatePath, validateUrl } from '../scripts/lib/input-validation.js';

describe('fetchGitHubReadme security (SEC-1)', () => {
  it('sanitizeForExecFile rejects shell metacharacters in owner', () => {
    expect(() => sanitizeForExecFile('foo;whoami')).toThrow(/invalid/i);
  });

  it('sanitizeForExecFile rejects shell metacharacters in repo', () => {
    expect(() => sanitizeForExecFile('bar$(cat /etc/passwd)')).toThrow(/invalid/i);
  });

  it('sanitizeForExecFile accepts valid GitHub names', () => {
    expect(sanitizeForExecFile('anthropics')).toBe('anthropics');
    expect(sanitizeForExecFile('claude-code')).toBe('claude-code');
  });
});

describe('fetch-raw path traversal (SEC-2)', () => {
  const homeDir = require('os').homedir();
  const mindloreHome = require('path').join(homeDir, '.mindlore');

  it('rejects --out-dir outside mindlore home', () => {
    expect(() => validatePath('/etc/evil', mindloreHome)).toThrow(/must be under/);
  });

  it('rejects --out-dir with traversal', () => {
    expect(() => validatePath(require('path').join(mindloreHome, '..', 'etc'), mindloreHome)).toThrow(/must be under/);
  });

  it('accepts valid raw directory', () => {
    expect(() => validatePath(require('path').join(mindloreHome, 'raw'), mindloreHome)).not.toThrow();
  });
});

describe('fetch-raw SSRF protection (SEC-10)', () => {
  it('rejects AWS metadata endpoint', () => {
    expect(() => validateUrl('http://169.254.169.254/latest/meta-data/')).toThrow(/private/i);
  });

  it('rejects localhost', () => {
    expect(() => validateUrl('http://127.0.0.1/admin')).toThrow(/private/i);
  });

  it('accepts public URLs', () => {
    expect(() => validateUrl('https://github.com/user/repo')).not.toThrow();
  });
});
