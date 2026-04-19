import fs from 'fs';
import path from 'path';

export interface Contradiction {
  rule: string;
  files: string[];
  detail: string;
}

interface FileMeta {
  path: string;
  slug: string;
  type: string;
  tags: string[];
  content: string;
}

function parseFrontmatterSimple(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  const block = match[1];
  if (!block) return result;
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return result;
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.replace(/^\[|\]$/g, '').split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
}

function loadFiles(baseDir: string): FileMeta[] {
  const files: FileMeta[] = [];
  const dirs = ['sources', 'domains', 'analyses', 'insights', 'decisions', 'learnings'];
  for (const dir of dirs) {
    const dirPath = path.join(baseDir, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(dirPath, file);
      const rawContent = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
      const meta = parseFrontmatterSimple(rawContent);
      files.push({
        path: filePath,
        slug: meta.slug ?? '',
        type: meta.type ?? '',
        tags: parseTags(meta.tags),
        content: rawContent.replace(/^---\n[\s\S]*?\n---\n?/, ''),
      });
    }
  }
  return files;
}

function groupBySharedTag(files: FileMeta[]): Map<string, FileMeta[]> {
  const tagMap = new Map<string, FileMeta[]>();
  for (const file of files) {
    for (const tag of file.tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(file); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- has() check above
    }
  }
  return tagMap;
}

function checkDateContradictions(files: FileMeta[]): Contradiction[] {
  const results: Contradiction[] = [];
  const tagMap = groupBySharedTag(files);
  const datePattern = /(\b[A-Z][\w.-]+(?:\s+[\w.-]+){0,3})\s+(?:was|were|is|will be)\s+\S+\s+(?:on|at|in)\s+(\d{4}-\d{2}-\d{2})/gi;

  for (const [_tag, group] of tagMap) {
    if (group.length < 2) continue;
    const claimMap = new Map<string, Array<{ file: string; date: string }>>();

    for (const f of group) {
      for (const m of f.content.matchAll(datePattern)) {
        const subject = (m[1] ?? '').toLowerCase().trim();
        const date = m[2] ?? '';
        if (!subject || !date) continue;
        if (!claimMap.has(subject)) claimMap.set(subject, []);
        claimMap.get(subject)!.push({ file: f.path, date }); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- has() check above
      }
    }

    for (const [subject, entries] of claimMap) {
      const dates = new Set(entries.map(e => e.date));
      if (dates.size > 1) {
        const uniqueFiles = [...new Set(entries.map(e => e.file))];
        if (uniqueFiles.length > 1) {
          results.push({
            rule: 'date-contradiction',
            files: uniqueFiles,
            detail: `"${subject}" has conflicting dates: ${[...dates].join(' vs ')}`,
          });
        }
      }
    }
  }
  return results;
}

function checkBooleanContradictions(files: FileMeta[]): Contradiction[] {
  const results: Contradiction[] = [];
  const tagMap = groupBySharedTag(files);
  const boolPattern = /\b(the\s+\w+(?:\s+\w+)?)\s+is\s+(enabled|disabled|true|false)\b/gi;

  for (const [_tag, group] of tagMap) {
    if (group.length < 2) continue;
    const claimMap = new Map<string, Array<{ file: string; state: string }>>();

    for (const f of group) {
      for (const m of f.content.matchAll(boolPattern)) {
        const subject = (m[1] ?? '').toLowerCase().trim();
        const state = (m[2] ?? '').toLowerCase();
        if (!subject || !state) continue;
        if (!claimMap.has(subject)) claimMap.set(subject, []);
        claimMap.get(subject)!.push({ file: f.path, state }); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- has() check above
      }
    }

    for (const [subject, entries] of claimMap) {
      const states = new Set(entries.map(e => e.state));
      const hasConflict =
        (states.has('enabled') && states.has('disabled')) ||
        (states.has('true') && states.has('false'));
      if (hasConflict) {
        const uniqueFiles = [...new Set(entries.map(e => e.file))];
        if (uniqueFiles.length > 1) {
          results.push({
            rule: 'boolean-contradiction',
            files: uniqueFiles,
            detail: `"${subject}" has conflicting states: ${[...states].join(' vs ')}`,
          });
        }
      }
    }
  }
  return results;
}

function checkVersionContradictions(files: FileMeta[]): Contradiction[] {
  const results: Contradiction[] = [];
  const tagMap = groupBySharedTag(files);
  const versionPattern = /(\b[A-Z][\w.-]+(?:\s+[\w.-]+){0,2})\s+version\s+(\d+(?:\.\d+)+)/gi;

  for (const [_tag, group] of tagMap) {
    if (group.length < 2) continue;
    const claimMap = new Map<string, Array<{ file: string; version: string }>>();

    for (const f of group) {
      for (const m of f.content.matchAll(versionPattern)) {
        const subject = (m[1] ?? '').toLowerCase().trim();
        const version = m[2] ?? '';
        if (!subject || !version) continue;
        if (!claimMap.has(subject)) claimMap.set(subject, []);
        claimMap.get(subject)!.push({ file: f.path, version }); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- has() check above
      }
    }

    for (const [subject, entries] of claimMap) {
      const versions = new Set(entries.map(e => e.version));
      if (versions.size > 1) {
        const uniqueFiles = [...new Set(entries.map(e => e.file))];
        if (uniqueFiles.length > 1) {
          results.push({
            rule: 'version-contradiction',
            files: uniqueFiles,
            detail: `"${subject}" has conflicting versions: ${[...versions].join(' vs ')}`,
          });
        }
      }
    }
  }
  return results;
}

function checkFrontmatterInconsistencies(files: FileMeta[]): Contradiction[] {
  const results: Contradiction[] = [];
  const slugMap = new Map<string, FileMeta[]>();

  for (const f of files) {
    if (!f.slug) continue;
    if (!slugMap.has(f.slug)) slugMap.set(f.slug, []);
    slugMap.get(f.slug)!.push(f); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- has() check above
  }

  for (const [slug, entries] of slugMap) {
    if (entries.length < 2) continue;
    const types = new Set(entries.map(e => e.type).filter(Boolean));
    if (types.size > 1) {
      results.push({
        rule: 'frontmatter-inconsistency',
        files: entries.map(e => e.path),
        detail: `duplicate slug "${slug}" with conflicting types: ${[...types].join(' vs ')}`,
      });
    }
  }
  return results;
}

export function detectContradictions(baseDir: string): Contradiction[] {
  const files = loadFiles(baseDir);
  return [
    ...checkDateContradictions(files),
    ...checkBooleanContradictions(files),
    ...checkVersionContradictions(files),
    ...checkFrontmatterInconsistencies(files),
  ];
}
