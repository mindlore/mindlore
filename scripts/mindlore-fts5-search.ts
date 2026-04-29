#!/usr/bin/env node

/**
 * mindlore-fts5-search — Search ~/.mindlore/ knowledge base.
 *
 * Usage: node dist/scripts/mindlore-fts5-search.js "query" [--all] [--project <name>] [--sessions]
 *
 * v0.6.3: Delegates to search-engine.ts pipeline (RRF fusion, title boost, category weight).
 */

import fs from 'fs';
import path from 'path';
import { DB_NAME, GLOBAL_MINDLORE_DIR, getProjectName, resolveHookCommon } from './lib/constants.js';
import { search } from './lib/search-engine.js';

const common: {
  openDatabase: (dbPath: string, opts?: { readonly?: boolean }) => import('better-sqlite3').Database | null;
  extractHeadings: (content: string, max?: number) => string[];
  readConfig: (dir: string) => Record<string, unknown> | null;
} = require(resolveHookCommon(__dirname));
const { openDatabase, extractHeadings, readConfig } = common;

const MAX_RESULTS = 3;

function main(): void {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isSessions = args.includes('--sessions');
  const projectIdx = args.indexOf('--project');
  const explicitProject = projectIdx !== -1 ? args[projectIdx + 1] : undefined;
  const query = args.find((a) => !a.startsWith('--') && a !== explicitProject);

  if (!query) {
    console.error('Usage: node mindlore-fts5-search.js "query" [--all] [--project <name>] [--sessions]');
    process.exit(1);
  }

  const dbPath = path.join(GLOBAL_MINDLORE_DIR, DB_NAME);
  if (!fs.existsSync(dbPath)) {
    console.error('  Database not found. Run: npx mindlore init && npm run index');
    process.exit(1);
  }

  const db = openDatabase(dbPath, { readonly: true });
  if (!db) {
    console.error('  Could not open database.');
    process.exit(1);
  }

  const projectFilter = isAll ? undefined : (explicitProject ?? getProjectName());
  const config = readConfig(GLOBAL_MINDLORE_DIR);
  const synonyms = (config && typeof config === 'object' && 'synonyms' in config)
    ? config.synonyms as Record<string, string[]>
    : {};

  try {
    const results = search(db, query, {
      project: projectFilter,
      maxResults: MAX_RESULTS,
      synonyms,
    });

    if (results.length === 0) {
      console.log(`  No results for: "${query}"`);
      process.exit(0);
    }

    const scopeLabel = isAll ? 'all' : `project:${projectFilter}`;
    const modeLabel = isSessions ? 'sessions' : 'rrf';
    console.log(`\n  Mindlore Search [${scopeLabel}] [${modeLabel}]: "${query}" (${results.length} results)\n`);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r) continue;
      const relativePath = path.relative(GLOBAL_MINDLORE_DIR, r.path);

      console.log(`  ${i + 1}. [${r.slug}] (score: ${r.score.toFixed(4)})`);
      if (r.description) console.log(`     ${r.description}`);
      console.log(`     ${relativePath}`);

      if (r.path && fs.existsSync(r.path)) {
        try {
          const content = fs.readFileSync(r.path, 'utf8');
          const headings = extractHeadings(content, 2);
          if (headings.length > 0) {
            console.log(`     ${headings.join(' > ')}`);
          }
        } catch (_err) { /* skip */ }
      }
      console.log('');
    }
  } finally {
    db.close();
  }
}

main();
