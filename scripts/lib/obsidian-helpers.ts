/**
 * obsidian-helpers — Shared utilities for Obsidian integration.
 */

import fs from 'fs';
import path from 'path';

/** Files/dirs to skip during export */
const SKIP_FILES = new Set([
  'config.json',
  'log.md',
  'INDEX.md',
  'SCHEMA.md',
  '.gitignore',
  '.version',
  '.pkg-version',
]);

const SKIP_DIRS = new Set(['.git']);

/**
 * Convert relative markdown links to Obsidian wikilinks.
 * `[text](../domains/x.md)` → `[[x]]`
 * `[text](./sources/y.md)` → `[[y]]`
 */
export function convertToWikilinks(content: string): string {
  return content.replace(
    /\[([^\]]+)\]\((?:\.\.?\/)?(?:[\w-]+\/)*([^/)]+)\.md\)/g,
    (_match, _text: string, filename: string) => `[[${filename}]]`,
  );
}

/**
 * Check if a file should be exported (newer than vault copy or no vault copy).
 */
export function shouldExport(
  srcPath: string,
  destPath: string,
  force: boolean,
): boolean {
  if (force) return true;
  if (!fs.existsSync(destPath)) return true;

  const srcStat = fs.statSync(srcPath);
  const destStat = fs.statSync(destPath);
  return srcStat.mtimeMs > destStat.mtimeMs;
}

/**
 * Check if a directory is an Obsidian vault (has .obsidian/ folder).
 */
export function isObsidianVault(dirPath: string): boolean {
  return fs.existsSync(path.join(dirPath, '.obsidian'));
}

/**
 * Recursively collect all .md files from a directory, excluding SKIP_FILES and SKIP_DIRS.
 */
export function collectMdFiles(
  baseDir: string,
  relativeTo?: string,
): Array<{ absolute: string; relative: string }> {
  const root = relativeTo ?? baseDir;
  const results: Array<{ absolute: string; relative: string }> = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch (_err) {
    return results;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('_')) continue;

    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectMdFiles(fullPath, root));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      if (SKIP_FILES.has(entry.name)) continue;
      if (entry.name.endsWith('.db')) continue;

      results.push({
        absolute: fullPath,
        relative: path.relative(root, fullPath),
      });
    }
  }

  return results;
}
