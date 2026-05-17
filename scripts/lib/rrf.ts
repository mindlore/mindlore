import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import { dbAll } from './db-helpers.js';
import { errMsg } from './err-msg.js';

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
  recallMapOrOptions?: Map<string, number> | RRFOptions,
  relationGraph?: Map<string, Set<string>>,
  options?: RRFOptions,
): RankedResult[] {
  let recallMap: Map<string, number> | undefined;
  let relGraph: Map<string, Set<string>> | undefined;
  let opts: RRFOptions;

  if (recallMapOrOptions instanceof Map) {
    recallMap = recallMapOrOptions;
    relGraph = relationGraph;
    opts = options ?? {};
  } else {
    opts = recallMapOrOptions ?? {};
  }

  const k = opts.k ?? 60;
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

  let maxRecallBoost = 0;
  let maxRelationBoost = 0;
  let boostedCount = 0;
  if (recallMap || relGraph) {
    const candidateSlugs = new Set(scores.keys());
    for (const [slug, item] of scores.entries()) {
      const recallCount = recallMap?.get(slug) ?? 0;
      const accessBoost = Math.min(1.0, Math.log2(recallCount + 1) / 5);
      const recallContribution = 0.3 * accessBoost;
      let relationProximity = 0;
      const neighbors = relGraph?.get(slug);
      if (neighbors && neighbors.size > 0) {
        let intersectionCount = 0;
        for (const n of neighbors) {
          if (candidateSlugs.has(n)) intersectionCount++;
        }
        relationProximity = Math.min(1.0, intersectionCount / 3);
      }
      const relationContribution = 0.15 * relationProximity;
      item.score += recallContribution + relationContribution;
      if (recallContribution > maxRecallBoost) maxRecallBoost = recallContribution;
      if (relationContribution > maxRelationBoost) maxRelationBoost = relationContribution;
      if (recallContribution > 0 || (neighbors && neighbors.size > 0)) boostedCount++;
    }
  }

  let results = Array.from(scores.values()).sort((a, b) => b.score - a.score);

  if (opts.dedupByPath) {
    const seen = new Set<string>();
    results = results.filter(r => {
      if (seen.has(r.path)) return false;
      seen.add(r.path);
      return true;
    });
  }

  try {
    const { writeTelemetry } = require('./telemetry-bridge.cjs');
    writeTelemetry({
      ts: new Date().toISOString(),
      event: 'rrf',
      result_count: results.length,
      boosted_count: boostedCount,
      max_recall_boost: Number(maxRecallBoost.toFixed(4)),
      max_relation_boost: Number(maxRelationBoost.toFixed(4)),
      top_final_score: results.length > 0 ? Number((results[0]?.score ?? 0).toFixed(4)) : 0,
    });
  } catch (_e) { /* graceful */ }

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
    const msg = errMsg(err);
    if (!msg.includes('no such table')) {
      console.warn(`searchTrigram: ${msg}`);
    }
    return [];
  }
}
