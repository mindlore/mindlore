import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateFrontmatter } from '../scripts/mindlore-health-check';

describe('frontmatter validation — type-aware rules', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mlhc-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('accepts raw file in nested raw/sessions/<project>/ path without slug', () => {
    const dir = path.join(tmpDir, 'raw', 'sessions', 'mindlore');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'sample.md'),
      '---\ntype: raw\nproject: mindlore\nsession_id: x\ndate: 2026-05-16\nstart_time: 2026-05-16T00:00:00Z\n---\nbody');
    const result = validateFrontmatter(tmpDir);
    expect(result.wrongDir).toBe(0);
    expect(result.missingSlug).toBe(0);
  });

  it('flags non-raw type with missing slug', () => {
    const dir = path.join(tmpDir, 'sources');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'sample.md'),
      '---\ntype: source\nname: Sample\n---\nbody');
    const result = validateFrontmatter(tmpDir);
    expect(result.missingSlug).toBe(1);
  });
});
