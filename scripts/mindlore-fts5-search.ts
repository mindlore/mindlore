#!/usr/bin/env node

/**
 * mindlore-fts5-search — Search ~/.mindlore/ knowledge base via FTS5.
 *
 * Usage: node dist/scripts/mindlore-fts5-search.js "query" [--all] [--project <name>]
 *
 * v0.3.3: Single global DB. Default: filter by current project. --all: no filter.
 * Returns top 3 results ranked by BM25 with file path and snippet.
 */

import fs from 'fs';
import path from 'path';
import { DB_NAME, GLOBAL_MINDLORE_DIR, getProjectName, resolveHookCommon } from './lib/constants.js';

 
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

function searchDb(dbPath: string, sanitized: string, projectFilter?: string): SearchResult[] {
  const db = openDatabase(dbPath, { readonly: true });
  if (!db) return [];

  try {
    if (projectFilter) {
      return db
        .prepare(
          `SELECT path, snippet(mindlore_fts, 1, '>>>', '<<<', '...', 40) as snippet,
                  rank
           FROM mindlore_fts
           WHERE mindlore_fts MATCH ? AND project = ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(sanitized, projectFilter, MAX_RESULTS) as SearchResult[];
    }
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
  const isAll = args.includes('--all');
  const projectIdx = args.indexOf('--project');
  const explicitProject = projectIdx !== -1 ? args[projectIdx + 1] : undefined;
  const query = args.find((a) => !a.startsWith('--') && a !== explicitProject);

  if (!query) {
    console.error('Usage: node mindlore-fts5-search.js "query" [--all] [--project <name>]');
    process.exit(1);
  }

  // v0.3.3: Single global DB
  const dbPath = path.join(GLOBAL_MINDLORE_DIR, DB_NAME);
  if (!fs.existsSync(dbPath)) {
    console.error('  Database not found. Run: npx mindlore init && npm run index');
    process.exit(1);
  }

  const sanitized = query.replace(/['"(){}[\]*:^~!]/g, ' ').trim();
  if (!sanitized) {
    console.log('  No valid search terms.');
    process.exit(0);
  }

  // Determine project filter
  const projectFilter = isAll ? undefined : (explicitProject ?? getProjectName());
  const results = searchDb(dbPath, sanitized, projectFilter);

  // If project-scoped search returns nothing, try all projects
  let relevant = results.slice(0, MAX_RESULTS);
  if (relevant.length === 0 && projectFilter) {
    relevant = searchDb(dbPath, sanitized).slice(0, MAX_RESULTS);
  }

  if (relevant.length === 0) {
    console.log(`  No results for: "${query}"`);
    process.exit(0);
  }

  const scopeLabel = isAll ? 'all' : `project:${projectFilter}`;
  console.log(`\n  Mindlore Search [${scopeLabel}]: "${query}" (${relevant.length} results)\n`);

  for (let i = 0; i < relevant.length; i++) {
    const r = relevant[i];
    if (!r) continue;
    const relativePath = path.relative(GLOBAL_MINDLORE_DIR, r.path);
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
