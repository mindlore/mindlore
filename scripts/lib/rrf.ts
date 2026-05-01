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

interface FtsSearchParams {
  table: string;
  rankExpr: string;
  orderBy: string;
  query: string;
  project?: string;
  limit: number;
}

const BM25_RANK_EXPR = 'bm25(mindlore_fts, 1, 1, 1, 5.0, 1, 1) as bm';

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

function _searchFts(db: Database, p: FtsSearchParams): RankedResult[] {
  const sql = p.project
    ? `SELECT path, slug, description, title, category, tags, content, ${p.rankExpr} FROM ${p.table} WHERE ${p.table} MATCH ? AND project = ? ORDER BY ${p.orderBy} LIMIT ?`
    : `SELECT path, slug, description, title, category, tags, content, ${p.rankExpr} FROM ${p.table} WHERE ${p.table} MATCH ? ORDER BY ${p.orderBy} LIMIT ?`;
  const params = p.project ? [p.query, p.project, p.limit] : [p.query, p.limit];
  return dbAll<RankedResult>(db, sql, ...params).map((r, i) => ({ ...r, rank: i + 1, score: 0 }));
}

export function searchPorter(
  db: Database,
  options: SearchQueryOptions,
): RankedResult[] {
  const sanitized = sanitizeFtsQuery(options.query);
  if (!sanitized) return [];
  return _searchFts(db, { table: 'mindlore_fts', rankExpr: BM25_RANK_EXPR, orderBy: 'bm', query: sanitized, project: options.project, limit: options.limit });
}

export function searchTrigram(
  db: Database,
  options: SearchQueryOptions,
): RankedResult[] {
  const sanitized = sanitizeFtsQuery(options.query);
  if (!sanitized) return [];
  try {
    return _searchFts(db, { table: 'mindlore_fts_trigram', rankExpr: 'rank', orderBy: 'rank', query: sanitized, project: options.project, limit: options.limit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('no such table')) {
      console.warn(`searchTrigram: ${msg}`);
    }
    return [];
  }
}
