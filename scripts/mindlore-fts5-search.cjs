#!/usr/bin/env node
'use strict';

/**
 * mindlore-fts5-search — Search .mindlore/ knowledge base via FTS5.
 *
 * Usage: node scripts/mindlore-fts5-search.cjs "query" [path-to-mindlore-dir]
 *
 * Returns top 3 results ranked by BM25 with file path and snippet.
 */

const fs = require('fs');
const path = require('path');

const DB_NAME = 'mindlore.db';
const MAX_RESULTS = 3;
const SNIPPET_LENGTH = 200;

// ── Helpers ────────────────────────────────────────────────────────────

function extractHeadings(content, maxHeadings) {
  const lines = content.split('\n');
  const headings = [];
  for (const line of lines) {
    if (line.startsWith('#')) {
      headings.push(line.replace(/^#+\s*/, '').trim());
      if (headings.length >= maxHeadings) break;
    }
  }
  return headings;
}

function extractSnippet(content, query, length) {
  // Try to find the query term in content for context
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase().split(/\s+/)[0];
  const idx = lowerContent.indexOf(lowerQuery);

  if (idx !== -1) {
    const start = Math.max(0, idx - 50);
    const end = Math.min(content.length, idx + length);
    let snippet = content.slice(start, end).replace(/\n/g, ' ').trim();
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet;
  }

  // Fallback: first N characters after frontmatter
  const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
  const bodyStart = fmEnd !== -1 ? fmEnd + 3 : 0;
  const body = content.slice(bodyStart).trim();
  const snippet = body.slice(0, length).replace(/\n/g, ' ').trim();
  return snippet.length < body.length ? snippet + '...' : snippet;
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  const query = process.argv[2];
  if (!query) {
    console.error('Usage: node mindlore-fts5-search.cjs "query" [mindlore-dir]');
    process.exit(1);
  }

  const baseDir = process.argv[3] || path.join(process.cwd(), '.mindlore');
  const dbPath = path.join(baseDir, DB_NAME);

  if (!fs.existsSync(dbPath)) {
    console.error('  Database not found. Run: npx mindlore init && npm run index');
    process.exit(1);
  }

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (_err) {
    console.error('  better-sqlite3 not installed.');
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    // Sanitize query for FTS5 (escape special chars)
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
         LIMIT ?`
      )
      .all(sanitized, MAX_RESULTS);

    if (results.length === 0) {
      console.log(`  No results for: "${query}"`);
      process.exit(0);
    }

    console.log(`\n  Mindlore Search: "${query}" (${results.length} results)\n`);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const relativePath = path.relative(baseDir, r.path);
      const fileName = path.basename(r.path, '.md');

      // Try to get headings from the actual file
      let headings = [];
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
    // FTS5 query syntax error — try simpler query
    if (err.message.includes('fts5')) {
      const words = query.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length > 0) {
        console.error(`  Search syntax error. Try simpler terms: ${words.join(' ')}`);
      } else {
        console.error(`  Search error: ${err.message}`);
      }
    } else {
      console.error(`  Error: ${err.message}`);
    }
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
