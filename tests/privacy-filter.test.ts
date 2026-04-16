import { redactSecrets, DEFAULT_PATTERNS } from '../scripts/lib/privacy-filter.js';

describe('Privacy Filter', () => {
  test('should redact OpenAI API keys', () => {
    const input = 'My key is sk-proj-abc123def456ghi789';
    const result = redactSecrets(input);
    expect(result).toBe('My key is [REDACTED]');
    expect(result).not.toContain('sk-proj-');
  });

  test('should redact AWS access keys', () => {
    const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('AKIA');
  });

  test('should redact GitHub tokens', () => {
    const input = 'token: ghp_ABCDEFghijklmnop1234567890abcdefGHIJ';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('ghp_');
  });

  test('should redact npm tokens', () => {
    const input = 'npm_abc123DEF456ghi789JKL012mno345PQR678stu';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
  });

  test('should redact connection strings', () => {
    const input = 'DB_URL=postgres://user:pass@host:5432/db';
    const result = redactSecrets(input);
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('pass@');
  });

  test('should redact .env style secrets', () => {
    const input = 'DATABASE_PASSWORD=supersecret123\nAPI_TOKEN=mytoken456';
    const result = redactSecrets(input);
    expect(result).not.toContain('supersecret123');
    expect(result).not.toContain('mytoken456');
  });

  test('should not redact normal text', () => {
    const input = 'This is a normal document about authentication patterns.';
    const result = redactSecrets(input);
    expect(result).toBe(input);
  });

  test('should accept custom patterns from config', () => {
    const input = 'CUSTOM_KEY=abc123';
    const custom = [/CUSTOM_KEY=\S+/g];
    const result = redactSecrets(input, custom);
    expect(result).toContain('[REDACTED]');
  });

  test('should export DEFAULT_PATTERNS array', () => {
    expect(Array.isArray(DEFAULT_PATTERNS)).toBe(true);
    expect(DEFAULT_PATTERNS.length).toBeGreaterThan(0);
  });
});
