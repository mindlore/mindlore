import Database from 'better-sqlite3';
import path from 'path';
import { dbAll } from './db-helpers.js';
import { resolveHookCommon } from './constants.js';

// Import shared utilities from CJS common module
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- dynamic CJS require, typed by mindlore-common.d.cts
const { extractKeywords, sanitizeKeyword } = require(resolveHookCommon(__dirname)) as {
  extractKeywords: (text: string) => string[];
  sanitizeKeyword: (kw: string) => string | null;
};

export interface SimilarResult {
  slug: string;
  path: string;
  title: string;
  description: string;
  score: number;
}

interface FtsRow extends Record<string, unknown> {
  slug: string;
  path: string;
  title: string;
  description: string;
  rank: number;
}

export function findSimilar(
  dbPath: string,
  text: string,
  options?: { maxResults?: number; threshold?: number }
): SimilarResult[] {
  const maxResults = options?.maxResults ?? 3;

  const keywords = extractKeywords(text);
  if (keywords.length === 0) return [];

  const sanitized = keywords.map(sanitizeKeyword).filter((s): s is string => s !== null && s.length > 0);
  if (sanitized.length === 0) return [];

  const ftsQuery = sanitized.join(' OR ');

  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const rows = dbAll<FtsRow>(
      db,
      `SELECT slug, path, title, description, rank
       FROM mindlore_fts
       WHERE mindlore_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      ftsQuery,
      maxResults,
    );

    return rows.map(r => ({
      slug: r.slug,
      path: r.path,
      title: r.title,
      description: r.description,
      score: Math.abs(r.rank),
    }));
  } catch (_err) {
    return [];
  } finally {
    db?.close();
  }
}

const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) {
  const queryArg = process.argv[2];
  const dbPathArg = process.argv[3] ?? path.join(
    process.env.MINDLORE_HOME ?? path.join(require('os').homedir(), '.mindlore'),
    'mindlore.db'
  );
  if (!queryArg) {
    console.error('Usage: node similarity.js "query text" [dbPath]');
    process.exit(1);
  }
  const results = findSimilar(dbPathArg, queryArg);
  if (results.length === 0) {
    console.log('No similar documents found.');
  } else {
    for (const r of results) {
      console.log(`[${r.score.toFixed(2)}] ${r.slug} — ${r.description}`);
    }
  }
}
