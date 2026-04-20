import fs from 'fs';
import path from 'path';

describe('daemon-client.js', () => {
  it('should exist as plain JS file (no build needed)', () => {
    const clientPath = path.join(__dirname, '..', 'scripts', 'lib', 'daemon-client.js');
    expect(fs.existsSync(clientPath)).toBe(true);
  });

  it('should use fs.writeSync for stdout flush on Windows', () => {
    const clientPath = path.join(__dirname, '..', 'scripts', 'lib', 'daemon-client.js');
    const src = fs.readFileSync(clientPath, 'utf8');
    expect(src).toContain('writeSync');
  });

  it('should read port from port file', () => {
    const clientPath = path.join(__dirname, '..', 'scripts', 'lib', 'daemon-client.js');
    const src = fs.readFileSync(clientPath, 'utf8');
    expect(src).toContain('port');
    expect(src).toContain('127.0.0.1');
  });
});

describe('search hook daemon integration', () => {
  it('should have daemon client connection code', () => {
    const hookSrc = fs.readFileSync(
      path.join(__dirname, '..', 'hooks', 'mindlore-search.cjs'), 'utf8'
    );
    expect(hookSrc).toContain('daemon-client');
    expect(hookSrc).toContain('requestEmbeddingSync');
  });

  it('should fall back to FTS5 with log on daemon failure', () => {
    const hookSrc = fs.readFileSync(
      path.join(__dirname, '..', 'hooks', 'mindlore-search.cjs'), 'utf8'
    );
    expect(hookSrc).toContain('FTS5-only');
    expect(hookSrc).toContain("hookLog('search'");
  });
});
