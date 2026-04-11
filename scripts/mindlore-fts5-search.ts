#!/usr/bin/env node

/**
 * mindlore-fts5-search — Search .mindlore/ knowledge base via FTS5.
 *
 * Usage: node dist/scripts/mindlore-fts5-search.js "query" [path-to-mindlore-dir]
 *
 * Returns top 3 results ranked by BM25 with file path and snippet.
 */

import fs from 'fs';
import path from 'path';
import { DB_NAME, resolveHookCommon } from './lib/constants.js';

 
const { openDatabase } = require(resolveHookCommon(__dirname)) as {
  openDatabase: (dbPath: string, opts?: { readonly: boolean }) => import('better-sqlite3').Database | null;
};

const MAX_RESULTS = 3;

// ── Helpers ────────────────────────────────────────────────────────────

function extractHeadings(content: string, maxHeadings: number): string[] {
  const lines = content.split('\n');
  const headings: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) {
      headings.push(line.replace(/^#+\s*/, '').trim());
      if (headings.length >= maxHeadings) break;
    }
  }
  return headings;
}

// ── Main ───────────────────────────────────────────────────────────────

interface SearchResult {
  path: string;
  snippet: string;
  rank: number;
}

function main(): void {
  const query = process.argv[2];
  if (!query) {
    console.error('Usage: node mindlore-fts5-search.js "query" [mindlore-dir]');
    process.exit(1);
  }

  const baseDir = process.argv[3] ?? path.join(process.cwd(), '.mindlore');
  const dbPath = path.join(baseDir, DB_NAME);

  if (!fs.existsSync(dbPath)) {
    console.error('  Database not found. Run: npx mindlore init && npm run index');
    process.exit(1);
  }

  const db = openDatabase(dbPath, { readonly: true });
  if (!db) {
    console.error('  better-sqlite3 not installed.');
    process.exit(1);
  }

  try {
    const sanitized = query.replace(/['"(){}[\]*:^~!]/g, ' ').trim();
    if (!sanitized) {
      console.log('  No valid search terms.');
      process.exit(0);
    }

    const results = db
      .prepare(
        `SELECT path, snippet(mindlore_fts, 1, '>>>', '<<<', '...', 40) as snippet,
                rank
         FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(sanitized, MAX_RESULTS) as SearchResult[];

    if (results.length === 0) {
      console.log(`  No results for: "${query}"`);
      process.exit(0);
    }

    console.log(`\n  Mindlore Search: "${query}" (${results.length} results)\n`);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r) continue;
      const relativePath = path.relative(baseDir, r.path);
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('fts5')) {
      const words = query.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length > 0) {
        console.error(`  Search syntax error. Try simpler terms: ${words.join(' ')}`);
      } else {
        console.error(`  Search error: ${message}`);
      }
    } else {
      console.error(`  Error: ${message}`);
    }
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
