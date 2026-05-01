import { sanitizeForExecFile } from '../scripts/lib/input-validation.js';

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
