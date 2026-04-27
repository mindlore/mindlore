#!/usr/bin/env node

/**
 * mindlore-fts5-search — Search ~/.mindlore/ knowledge base via FTS5.
 *
 * Usage: node dist/scripts/mindlore-fts5-search.js "query" [--all] [--project <name>] [--hybrid]
 *
 * v0.3.3: Single global DB. Default: filter by current project. --all: no filter.
 * v0.5.0: --hybrid flag enables vector search + RRF fusion + synonym expansion.
 * Returns top 3 results ranked by BM25 (or hybrid score) with file path and snippet.
 */

import fs from 'fs';
import path from 'path';
import type { Database } from 'better-sqlite3';
import { DB_NAME, GLOBAL_MINDLORE_DIR, getProjectName, resolveHookCommon, fixVersionTokens } from './lib/constants.js';
import { dbAll, loadSqliteVec } from './lib/db-helpers.js';
import { hybridSearch } from './lib/hybrid-search.js';
import { generateEmbedding } from './lib/embedding.js';
import { loadSynonyms, expandQuery } from './lib/synonym.js';

const common: {
  openDatabase: (dbPath: string, opts?: { readonly?: boolean }) => Database | null;
  extractHeadings: (content: string, max?: number) => string[];
  readConfig: (dir: string) => Record<string, unknown> | null;
} = require(resolveHookCommon(__dirname));
const { openDatabase, extractHeadings, readConfig } = common;

const MAX_RESULTS = 3;

// ── FTS5-only search (original path) ──────────────────────────────────

interface SearchResult extends Record<string, unknown> {
  path: string;
  snippet: string;
  rank: number;
}

function queryDb(db: Database, sanitized: string, projectFilter?: string, table = 'mindlore_fts'): SearchResult[] {
  try {
    if (projectFilter) {
      return dbAll<SearchResult>(
        db,
        `SELECT path, snippet(${table}, 1, '>>>', '<<<', '...', 40) as snippet,
                rank
         FROM ${table}
         WHERE ${table} MATCH ? AND project = ?
         ORDER BY rank
         LIMIT ?`,
        sanitized, projectFilter, MAX_RESULTS,
      );
    }
    return dbAll<SearchResult>(
      db,
      `SELECT path, snippet(${table}, 1, '>>>', '<<<', '...', 40) as snippet,
              rank
       FROM ${table}
       WHERE ${table} MATCH ?
       ORDER BY rank
       LIMIT ?`,
      sanitized, MAX_RESULTS,
    );
  } catch (_err) {
    return [];
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isSessions = args.includes('--sessions');
  const isHybrid = args.includes('--hybrid');
  const projectIdx = args.indexOf('--project');
  const explicitProject = projectIdx !== -1 ? args[projectIdx + 1] : undefined;
  const query = args.find((a) => !a.startsWith('--') && a !== explicitProject);

  if (!query) {
    console.error('Usage: node mindlore-fts5-search.js "query" [--all] [--project <name>] [--hybrid]');
    process.exit(1);
  }

  // v0.3.3: Single global DB
  const dbPath = path.join(GLOBAL_MINDLORE_DIR, DB_NAME);
  if (!fs.existsSync(dbPath)) {
    console.error('  Database not found. Run: npx mindlore init && npm run index');
    process.exit(1);
  }

  const sanitized = fixVersionTokens(
    query.replace(/[(){}[\]*:^~!]/g, ' ').replace(/'/g, ' ')
  ).trim();
  if (!sanitized) {
    console.log('  No valid search terms.');
    process.exit(0);
  }

  const projectFilter = isAll ? undefined : (explicitProject ?? getProjectName());

  const db = openDatabase(dbPath, { readonly: true });
  if (!db) {
    console.error('  Could not open database.');
    process.exit(1);
  }

  try {
    if (isHybrid) {
      // ── Hybrid search path ──────────────────────────────────────
      const vecLoaded = loadSqliteVec(db);
      let queryEmbedding: number[] | undefined;

      if (vecLoaded) {
        try {
          queryEmbedding = await generateEmbedding(`query: ${sanitized}`);
        } catch (_err) {
          // Embedding failed — fall back to FTS5 only within hybrid
        }
      }

      // Load synonyms from config
      const config = readConfig(GLOBAL_MINDLORE_DIR);
      const synonyms = config ? loadSynonyms(config as Record<string, unknown>) : {};
      const expandedTerms = expandQuery(sanitized, synonyms);
      const expandedQuery = expandedTerms.join(' ');

      const results = hybridSearch(db, expandedQuery, {
        maxResults: MAX_RESULTS,
        queryEmbedding,
        project: projectFilter,
      });

      if (results.length === 0) {
        console.log(`  No results for: "${query}"`);
        process.exit(0);
      }

      const scopeLabel = isAll ? 'all' : `project:${projectFilter}`;
      const modeLabel = queryEmbedding ? 'hybrid' : 'hybrid(fts5-only)';
      console.log(`\n  Mindlore Search [${scopeLabel}] [${modeLabel}]: "${query}" (${results.length} results)\n`);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r) continue;
        console.log(`  ${i + 1}. [${r.slug}] (score: ${r.score.toFixed(4)})`);
        if (r.description) console.log(`     ${r.description}`);
        if (r.path) {
          const relativePath = path.relative(GLOBAL_MINDLORE_DIR, r.path);
          console.log(`     ${relativePath}`);
        }
        console.log('');
      }
    } else {
      // ── FTS5-only search path (unchanged) ───────────────────────
      const tableName = isSessions ? 'mindlore_fts_sessions' : 'mindlore_fts';
      let relevant = queryDb(db, sanitized, projectFilter, tableName);
      // If project-scoped search returns nothing, fallback to all projects
      if (relevant.length === 0 && projectFilter) {
        relevant = queryDb(db, sanitized, undefined, tableName);
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
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
