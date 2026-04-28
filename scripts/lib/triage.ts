import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';

export interface RawFileInfo {
  name: string;
  path: string;
  size: number;
}

export interface RawMetadata {
  title: string;
  url: string | null;
  date_captured: string | null;
  headings: string;
  file_size: number;
  line_count: number;
}

export function listUnpromoted(baseDir: string): RawFileInfo[] {
  const rawDir = path.join(baseDir, 'raw');
  const sourcesDir = path.join(baseDir, 'sources');

  if (!fs.existsSync(rawDir)) return [];

  const sourceNames = fs.existsSync(sourcesDir)
    ? new Set(fs.readdirSync(sourcesDir).filter(f => f.endsWith('.md')))
    : new Set<string>();

  return fs.readdirSync(rawDir)
    .filter(f => f.endsWith('.md') && !sourceNames.has(f))
    .map(f => ({
      name: f,
      path: path.join(rawDir, f),
      size: fs.statSync(path.join(rawDir, f)).size,
    }));
}

export function extractRawMetadata(filePath: string): RawMetadata {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let title = '';
  let url: string | null = null;
  let dateCaptured: string | null = null;
  const headings: string[] = [];
  let inFrontmatter = false;
  let frontmatterDone = false;

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!frontmatterDone) {
        inFrontmatter = !inFrontmatter;
        if (!inFrontmatter) frontmatterDone = true;
      }
      continue;
    }

    if (inFrontmatter) {
      const urlMatch = line.match(/^url:\s*(.+)/);
      if (urlMatch?.[1]) url = urlMatch[1].trim();
      const dateMatch = line.match(/^date_captured:\s*(.+)/);
      if (dateMatch?.[1]) dateCaptured = dateMatch[1].trim();
      continue;
    }

    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match?.[1] && !title) {
      title = h1Match[1].trim();
      continue;
    }

    const hMatch = line.match(/^#{2,6}\s+(.+)/);
    if (hMatch?.[1]) {
      headings.push(hMatch[1].trim());
    }
  }

  return {
    title: title || path.basename(filePath, '.md'),
    url,
    date_captured: dateCaptured,
    headings: headings.join(', '),
    file_size: Buffer.byteLength(content),
    line_count: lines.length,
  };
}

export function cacheRawMetadata(db: Database.Database, filePath: string, baseDir: string): void {
  const meta = extractRawMetadata(filePath);
  const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');

  db.prepare(`
    INSERT OR REPLACE INTO raw_metadata (path, title, url, date_captured, headings, file_size, line_count, extracted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(relPath, meta.title, meta.url, meta.date_captured, meta.headings, meta.file_size, meta.line_count, new Date().toISOString());
}
