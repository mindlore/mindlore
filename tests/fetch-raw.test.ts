import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('fetch-raw script', () => {
  const tmpDir = path.join(os.tmpdir(), 'mindlore-fetch-test-' + Date.now());

  beforeAll(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('fetches a URL and saves to output dir', () => {
    const result = execSync(
      `node dist/scripts/fetch-raw.js https://raw.githubusercontent.com/anthropics/claude-code/main/README.md --out-dir "${tmpDir}"`,
      { encoding: 'utf8', timeout: 30000 }
    );
    const parsed = JSON.parse(result.trim());
    expect(parsed.saved).toBeTruthy();
    expect(parsed.chars).toBeGreaterThan(100);
    expect(fs.existsSync(parsed.saved)).toBe(true);
  });

  it('outputs valid JSON with saved path and char count (or cache hit)', () => {
    const result = execSync(
      `node dist/scripts/fetch-raw.js https://raw.githubusercontent.com/anthropics/claude-code/main/README.md --out-dir "${tmpDir}"`,
      { encoding: 'utf8', timeout: 30000 }
    );
    const parsed = JSON.parse(result.trim());
    const filePath = parsed.saved ?? parsed.file;
    expect(filePath).toBeTruthy();
    if (parsed.saved) {
      expect(parsed).toHaveProperty('chars');
      expect(typeof parsed.chars).toBe('number');
    } else {
      expect(parsed.cached).toBe(true);
    }
  });

  it('generates frontmatter with slug and date', () => {
    const result = execSync(
      `node dist/scripts/fetch-raw.js https://raw.githubusercontent.com/anthropics/claude-code/main/README.md --out-dir "${tmpDir}"`,
      { encoding: 'utf8', timeout: 30000 }
    );
    const parsed = JSON.parse(result.trim());
    const filePath = parsed.saved ?? parsed.file;
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('---');
    expect(content).toContain('slug:');
    expect(content).toContain('date_captured:');
    expect(content).toContain('source_url:');
  });

  it('exits with error when no URL provided', () => {
    expect(() => {
      execSync(
        `node dist/scripts/fetch-raw.js --out-dir "${tmpDir}"`,
        { encoding: 'utf8', timeout: 5000 }
      );
    }).toThrow();
  });
});
