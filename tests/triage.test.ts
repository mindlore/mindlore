import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDbWithMigrations } from './helpers/db.js';
import { listUnpromoted, extractRawMetadata, cacheRawMetadata } from '../scripts/lib/triage.js';

describe('raw inbox triage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'triage-'));
    fs.mkdirSync(path.join(tmpDir, 'raw'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'sources'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists unpromoted raw files', () => {
    fs.writeFileSync(path.join(tmpDir, 'raw', 'orphan.md'), '# Title\nContent here');
    fs.writeFileSync(path.join(tmpDir, 'sources', 'existing.md'), '# Existing');

    const result = listUnpromoted(tmpDir);
    expect(result.some(r => r.name === 'orphan.md')).toBe(true);
    expect(result.some(r => r.name === 'existing.md')).toBe(false);
  });

  it('returns empty for non-existent raw dir', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'triage-empty-'));
    const result = listUnpromoted(emptyDir);
    expect(result).toHaveLength(0);
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it('extracts metadata from raw file', () => {
    const content = [
      '---',
      'url: https://example.com',
      'date_captured: 2026-04-01',
      '---',
      '# Main Title',
      '## Section 1',
      '## Section 2',
      'Some content here.',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, 'raw', 'test.md'), content);

    const meta = extractRawMetadata(path.join(tmpDir, 'raw', 'test.md'));
    expect(meta.title).toBe('Main Title');
    expect(meta.url).toBe('https://example.com');
    expect(meta.headings).toContain('Section 1');
    expect(meta.line_count).toBe(8);
  });

  it('uses filename as fallback title', () => {
    fs.writeFileSync(path.join(tmpDir, 'raw', 'no-heading.md'), 'Just some text');
    const meta = extractRawMetadata(path.join(tmpDir, 'raw', 'no-heading.md'));
    expect(meta.title).toBe('no-heading');
  });

  it('caches metadata in raw_metadata table', () => {
    fs.writeFileSync(path.join(tmpDir, 'raw', 'cached.md'), '# Cached\nContent');
    const dbPath = path.join(tmpDir, 'mindlore.db');
    const db = createTestDbWithMigrations(dbPath);

    cacheRawMetadata(db, path.join(tmpDir, 'raw', 'cached.md'), tmpDir);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const row = db.prepare("SELECT * FROM raw_metadata WHERE path = ?").get('raw/cached.md') as { title: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.title).toBe('Cached');
    db.close();
  });
});
