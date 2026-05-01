import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import { dbAll } from './db-helpers.js';

export function sanitizeFtsQuery(query: string): string {
  return query.replace(/["*(){}[\]^~:-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface RankedResult {
  slug: string;
  rank: number;
  path: string;
  score: number;
  description?: string;
  title?: string;
  category?: string;
  tags?: string;
  content?: string;
}

export interface RRFOptions {
  k?: number;
  dedupByPath?: boolean;
}

export interface SearchQueryOptions {
  query: string;
  limit: number;
  project?: string;
}

export function computeRRF(
  porterResults: RankedResult[],
  trigramResults: RankedResult[],
  options: RRFOptions = {},
): RankedResult[] {
  const k = options.k ?? 60;
  const scores = new Map<string, RankedResult>();

  for (const list of [porterResults, trigramResults]) {
    for (const r of list) {
      const existing = scores.get(r.slug);
      const rrfScore = 1 / (k + r.rank);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(r.slug, { ...r, score: rrfScore });
      }
    }
  }

  let results = Array.from(scores.values()).sort((a, b) => b.score - a.score);

  if (options.dedupByPath) {
    const seen = new Set<string>();
    results = results.filter(r => {
      if (seen.has(r.path)) return false;
      seen.add(r.path);
      return true;
    });
  }

  return results;
}

export function searchPorter(
  db: Database,
  options: SearchQueryOptions,
): RankedResult[] {
  const sanitized = sanitizeFtsQuery(options.query);
  if (!sanitized) return [];
  const sql = options.project
    ? 'SELECT path, slug, description, title, category, tags, content, bm25(mindlore_fts, 1, 1, 1, 5.0, 1, 1) as bm FROM mindlore_fts WHERE mindlore_fts MATCH ? AND project = ? ORDER BY bm LIMIT ?'
    : 'SELECT path, slug, description, title, category, tags, content, bm25(mindlore_fts, 1, 1, 1, 5.0, 1, 1) as bm FROM mindlore_fts WHERE mindlore_fts MATCH ? ORDER BY bm LIMIT ?';
  const params = options.project ? [sanitized, options.project, options.limit] : [sanitized, options.limit];
  return dbAll<RankedResult & { bm: number }>(db, sql, ...params).map((r, i) => ({ ...r, rank: i + 1, score: 0 }));
}

export function searchTrigram(
  db: Database,
  options: SearchQueryOptions,
): RankedResult[] {
  const sanitized = sanitizeFtsQuery(options.query);
  if (!sanitized) return [];
  try {
    const sql = options.project
      ? 'SELECT path, slug, description, title, category, tags, content, rank FROM mindlore_fts_trigram WHERE mindlore_fts_trigram MATCH ? AND project = ? ORDER BY rank LIMIT ?'
      : 'SELECT path, slug, description, title, category, tags, content, rank FROM mindlore_fts_trigram WHERE mindlore_fts_trigram MATCH ? ORDER BY rank LIMIT ?';
    const params = options.project ? [sanitized, options.project, options.limit] : [sanitized, options.limit];
    return dbAll<RankedResult>(db, sql, ...params).map((r, i) => ({ ...r, rank: i + 1, score: 0 }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('no such table')) {
      console.warn(`searchTrigram: ${msg}`);
    }
    return [];
  }
}
