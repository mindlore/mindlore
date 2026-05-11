import path from 'path';
import fs from 'fs';
import os from 'os';

// Mock before import
const originalCwd = process.cwd;

afterEach(() => {
  process.cwd = originalCwd;
  delete process.env.MINDLORE_HOME;
});

describe('resolveMindloreHome', () => {
  let resolveMindloreHome: () => string;

  beforeAll(async () => {
    const mod = await import('../scripts/lib/mcp-namespace.js');
    resolveMindloreHome = mod.resolveMindloreHome;
  });

  it('returns global path even when cwd has .mindlore/', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-test-'));
    const localMindlore = path.join(tmpDir, '.mindlore');
    fs.mkdirSync(localMindlore, { recursive: true });
    process.cwd = () => tmpDir;

    const result = resolveMindloreHome();
    expect(result).toBe(path.join(os.homedir(), '.mindlore'));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('respects MINDLORE_HOME env var', () => {
    const customDir = path.join(os.tmpdir(), 'custom-mindlore-' + Date.now());
    process.env.MINDLORE_HOME = customDir;

    const result = resolveMindloreHome();
    expect(result).toBe(path.resolve(customDir));
  });

  it('returns ~/.mindlore by default', () => {
    const result = resolveMindloreHome();
    expect(result).toBe(path.join(os.homedir(), '.mindlore'));
  });
});
