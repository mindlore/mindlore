import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { extractUrl } from '../scripts/lib/extractors/url-extractor';
import { extractPdf } from '../scripts/lib/extractors/pdf-extractor';
import { extractFile } from '../scripts/lib/extractors/file-extractor';

describe('URL extractor (F-ext)', () => {
  test('parses HTML title and meta description', async () => {
    const html = `<html><head><title>Test Page</title><meta name="description" content="Hello"></head><body><h1>Heading</h1></body></html>`;
    const result = await extractUrl('https://example.com/test', html);
    expect(result.title).toBe('Test Page');
    expect(result.summary).toContain('Hello');
    expect(result.domain).toBe('example.com');
    expect(result.canonical_url).toBe('https://example.com/test');
  });

  test('falls back to h1 if no title tag', async () => {
    const html = `<html><body><h1>Main Heading</h1></body></html>`;
    const result = await extractUrl('https://example.com/x', html);
    expect(result.title).toBe('Main Heading');
  });
});

describe('PDF extractor (F-ext)', () => {
  test('extracts metadata from real PDF fixture', async () => {
    const fixturePath = path.join(__dirname, 'fixtures/sample.pdf');
    if (!fs.existsSync(fixturePath)) {
      console.warn('Skipping PDF test — fixture missing');
      return;
    }
    const buf = fs.readFileSync(fixturePath);
    const result = await extractPdf(buf);
    expect(result.title).toBeTruthy();
    expect(result.page_count).toBeGreaterThan(0);
  });
});

describe('File extractor (F-ext)', () => {
  test('detects language from extension', () => {
    const result = extractFile('/path/to/code.ts', 'export const x = 1;');
    expect(result.language).toBe('typescript');
    expect(result.summary).toContain('export const x = 1');
  });
  test('handles markdown', () => {
    const result = extractFile('/path/to/notes.md', '# Hello\n\nContent');
    expect(result.language).toBe('markdown');
  });
});
