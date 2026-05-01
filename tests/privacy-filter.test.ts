import { redactSecrets } from '../scripts/lib/privacy-filter.js';

describe('privacy-filter redaction (SEC-5)', () => {
  it('redacts api_key key-value pair', () => {
    expect(redactSecrets('api_key=sk_test_12345abcdef')).not.toContain('sk_test_12345abcdef');
  });

  it('redacts auth_token key-value pair', () => {
    expect(redactSecrets('auth_token: "mySecretToken123"')).not.toContain('mySecretToken123');
  });

  it('redacts access_token', () => {
    expect(redactSecrets('access_token=eyJhbGciOiJIUzI1NiJ9')).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts refresh_token', () => {
    expect(redactSecrets('refresh_token: refresh_abc123def456')).not.toContain('refresh_abc123def456');
  });

  it('redacts client_secret', () => {
    expect(redactSecrets('client_secret="superSecretValue123"')).not.toContain('superSecretValue123');
  });

  it('redacts private_key value', () => {
    expect(redactSecrets("private_key = 'my-private-key-value-here'")).not.toContain('my-private-key-value-here');
  });

  it('redacts Authorization Basic header', () => {
    expect(redactSecrets('Basic dXNlcjpwYXNzd29yZA==')).not.toContain('dXNlcjpwYXNzd29yZA==');
  });

  it('redacts BEGIN CERTIFICATE', () => {
    const result = redactSecrets('-----BEGIN CERTIFICATE-----');
    expect(result).toContain('[REDACTED]');
  });

  it('preserves non-secret text', () => {
    expect(redactSecrets('Hello world, this is normal text')).toBe('Hello world, this is normal text');
  });

  it('redacts existing patterns still work (JWT)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(redactSecrets(jwt)).not.toContain(jwt);
  });

  it('redacts secret_key key-value', () => {
    expect(redactSecrets('secret_key: abcdefghijklmnop')).not.toContain('abcdefghijklmnop');
  });
});
