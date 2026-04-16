import Database from 'better-sqlite3';
import { dbAll } from './db-helpers.js';

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

  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'and', 'but', 'or', 'not',
    'this', 'that', 'it', 'its', 'bir', 've', 'ile', 'icin', 'bu', 'de', 'da',
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF]+/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 8);

  if (words.length === 0) return [];

  const sanitized = words
    .map(w => w.replace(/["*(){}[\]^~:]/g, ''))
    .filter(Boolean);
  if (sanitized.length === 0) return [];

  const ftsQuery = sanitized.map(w => `"${w}"`).join(' OR ');

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
  const dbPathArg = process.argv[3] ?? require('path').join(
    process.env.MINDLORE_HOME ?? require('path').join(require('os').homedir(), '.mindlore'),
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
