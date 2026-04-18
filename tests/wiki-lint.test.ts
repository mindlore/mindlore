import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectWikiContradictions } from '../scripts/mindlore-health-check.js';

describe('wiki lint (contradiction detection)', () => {
  let tmpDir: string;
  let sourcesDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-wikilint-'));
    sourcesDir = path.join(tmpDir, 'sources');
    fs.mkdirSync(sourcesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects conflicting numeric claims with same tag', () => {
    fs.writeFileSync(
      path.join(sourcesDir, 'a.md'),
      '---\nslug: a\ntype: source\ntags: [fts5]\n---\nFTS5 has 10 columns.',
      'utf8',
    );
    fs.writeFileSync(
      path.join(sourcesDir, 'b.md'),
      '---\nslug: b\ntype: source\ntags: [fts5]\n---\nFTS5 uses 9 columns.',
      'utf8',
    );

    const warnings = detectWikiContradictions(tmpDir);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/conflicting values/);
    expect(warnings[0]).toMatch(/10.*9|9.*10/);
  });

  it('no contradiction when values match', () => {
    fs.writeFileSync(
      path.join(sourcesDir, 'a.md'),
      '---\nslug: a\ntype: source\ntags: [fts5]\n---\nFTS5 has 11 columns.',
      'utf8',
    );
    fs.writeFileSync(
      path.join(sourcesDir, 'b.md'),
      '---\nslug: b\ntype: source\ntags: [fts5]\n---\nFTS5 uses 11 columns.',
      'utf8',
    );

    const warnings = detectWikiContradictions(tmpDir);
    expect(warnings.length).toBe(0);
  });

  it('ignores files with no tags', () => {
    fs.writeFileSync(
      path.join(sourcesDir, 'a.md'),
      '---\nslug: a\ntype: source\n---\nFTS5 has 10 columns.',
      'utf8',
    );
    fs.writeFileSync(
      path.join(sourcesDir, 'b.md'),
      '---\nslug: b\ntype: source\n---\nFTS5 uses 9 columns.',
      'utf8',
    );

    const warnings = detectWikiContradictions(tmpDir);
    expect(warnings.length).toBe(0);
  });

  it('no false positive when only one file has a tag', () => {
    fs.writeFileSync(
      path.join(sourcesDir, 'a.md'),
      '---\nslug: a\ntype: source\ntags: [fts5]\n---\nFTS5 has 10 columns.',
      'utf8',
    );

    const warnings = detectWikiContradictions(tmpDir);
    expect(warnings.length).toBe(0);
  });
});
