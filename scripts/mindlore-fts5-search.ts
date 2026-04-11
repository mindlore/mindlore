#!/usr/bin/env node

/**
 * mindlore-fts5-search — Search .mindlore/ knowledge base via FTS5.
 *
 * Usage: node dist/scripts/mindlore-fts5-search.js "query" [--global] [--all]
 *
 * Returns top 3 results ranked by BM25 with file path and snippet.
 */

import fs from 'fs';
import path from 'path';
import { DB_NAME, GLOBAL_MINDLORE_DIR, MINDLORE_DIR, resolveHookCommon } from './lib/constants.js';

 
const { openDatabase, extractHeadings } = require(resolveHookCommon(__dirname)) as {
  openDatabase: (dbPath: string, opts?: { readonly: boolean }) => import('better-sqlite3').Database | null;
  extractHeadings: (content: string, max: number) => string[];
};

const MAX_RESULTS = 3;

// ── Main ───────────────────────────────────────────────────────────────

interface SearchResult {
  path: string;
  snippet: string;
  rank: number;
}

function searchSingleDb(dbPath: string, sanitized: string): SearchResult[] {
  const db = openDatabase(dbPath, { readonly: true });
  if (!db) return [];

  try {
    return db
      .prepare(
        `SELECT path, snippet(mindlore_fts, 1, '>>>', '<<<', '...', 40) as snippet,
                rank
         FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(sanitized, MAX_RESULTS) as SearchResult[];
  } catch (_err) {
    return [];
  } finally {
    db.close();
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const isGlobal = args.includes('--global');
  const isAll = args.includes('--all');
  const query = args.find((a) => !a.startsWith('--'));

  if (!query) {
    console.error('Usage: node mindlore-fts5-search.js "query" [--global] [--all]');
    process.exit(1);
  }

  // Determine which directories to search
  const searchDirs: string[] = [];
  const projectDir = path.join(process.cwd(), MINDLORE_DIR);

  if (isAll) {
    if (fs.existsSync(projectDir)) searchDirs.push(projectDir);
    if (fs.existsSync(GLOBAL_MINDLORE_DIR) && GLOBAL_MINDLORE_DIR !== projectDir) {
      searchDirs.push(GLOBAL_MINDLORE_DIR);
    }
  } else if (isGlobal) {
    searchDirs.push(GLOBAL_MINDLORE_DIR);
  } else {
    searchDirs.push(fs.existsSync(projectDir) ? projectDir : GLOBAL_MINDLORE_DIR);
  }

  const validDirs = searchDirs.filter((d) => fs.existsSync(path.join(d, DB_NAME)));
  if (validDirs.length === 0) {
    console.error('  Database not found. Run: npx mindlore init && npm run index');
    process.exit(1);
  }

  const sanitized = query.replace(/['"(){}[\]*:^~!]/g, ' ').trim();
  if (!sanitized) {
    console.log('  No valid search terms.');
    process.exit(0);
  }

  // Search all target DBs, collect results with their baseDir
  const allResults: Array<SearchResult & { baseDir: string }> = [];
  for (const dir of validDirs) {
    const dbPath = path.join(dir, DB_NAME);
    const results = searchSingleDb(dbPath, sanitized);
    for (const r of results) {
      allResults.push({ ...r, baseDir: dir });
    }
  }

  // Sort by rank, deduplicate by full path (project wins — appears first)
  allResults.sort((a, b) => a.rank - b.rank);
  const seen = new Set<string>();
  const unique = allResults.filter((r) => {
    const normalized = path.resolve(r.path);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  const relevant = unique.slice(0, MAX_RESULTS);

  if (relevant.length === 0) {
    console.log(`  No results for: "${query}"`);
    process.exit(0);
  }

  const scopeLabel = isAll ? 'all' : isGlobal ? 'global' : 'project';
  console.log(`\n  Mindlore Search [${scopeLabel}]: "${query}" (${relevant.length} results)\n`);

  for (let i = 0; i < relevant.length; i++) {
    const r = relevant[i];
    if (!r) continue;
    const relativePath = path.relative(r.baseDir, r.path);
    const fileName = path.basename(r.path, '.md');

    let headings: string[] = [];
    if (fs.existsSync(r.path)) {
      const content = fs.readFileSync(r.path, 'utf8');
      headings = extractHeadings(content, 2);
    }

    console.log(`  ${i + 1}. ${relativePath}`);
    if (headings.length > 0) {
      console.log(`     ${headings.join(' > ')}`);
    }
    console.log(`     ${r.snippet || fileName}`);
    console.log('');
  }
}

main();
