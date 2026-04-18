import type BetterSqlite3 from 'better-sqlite3';
import { dbAll, hasVecTable } from './db-helpers.js';

type Database = BetterSqlite3.Database;

export interface FtsResult {
  [key: string]: unknown;
  slug: string;
  rank: number;
  path?: string;
  description?: string;
  title?: string;
  category?: string;
  tags?: string;
}

export interface VecResult {
  [key: string]: unknown;
  slug: string;
  distance: number;
}

export interface FusedResult {
  slug: string;
  score: number;
  ftsRank?: number;
  vecDistance?: number;
  path?: string;
  description?: string;
  title?: string;
  category?: string;
  tags?: string;
}

export interface RRFOptions {
  k?: number;          // default 60
  ftsWeight?: number;  // default 0.4
  vecWeight?: number;  // default 0.6
}

export interface HybridSearchOptions {
  maxResults?: number;  // default 5
  k?: number;
  ftsWeight?: number;
  vecWeight?: number;
  synonyms?: Record<string, string[]>;
  project?: string;
  queryEmbedding?: number[];
}

// ── Utility Functions ──────────────────────────────────────────────

/**
 * Convert L2 distance to cosine similarity.
 * For normalized vectors: cosine_sim = 1.0 - (l2_dist² / 2.0)
 */
export function l2ToCosine(l2Distance: number): number {
  const cosine = 1.0 - (l2Distance * l2Distance / 2.0);
  return Math.max(0.0, Math.min(1.0, cosine));
}

// Empirical upper bound for BM25 absolute rank in Mindlore corpus (~150 docs)
const BM25_MAX_RANK = 25.0;

/**
 * Normalize FTS5 BM25 rank to 0-1 range.
 * FTS5 returns negative rank — more negative = better match.
 */
export function normalizeBM25(rank: number): number {
  return Math.abs(rank) / BM25_MAX_RANK;
}

// ── RRF Fusion ─────────────────────────────────────────────────────

export function computeRRF(
  ftsResults: FtsResult[],
  vecResults: VecResult[],
  options: RRFOptions = {},
): FusedResult[] {
  const k = options.k ?? 60;
  const ftsWeight = options.ftsWeight ?? 0.4;
  const vecWeight = options.vecWeight ?? 0.6;

  const scores = new Map<string, FusedResult>();

  // FTS5 results — already sorted by rank (most negative first = best)
  for (let i = 0; i < ftsResults.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loop guard: i < length
    const r = ftsResults[i]!;
    const rrfScore = ftsWeight * (1.0 / (k + i + 1));
    const existing = scores.get(r.slug);
    if (existing) {
      existing.score += rrfScore;
      existing.ftsRank = r.rank;
    } else {
      scores.set(r.slug, {
        slug: r.slug,
        score: rrfScore,
        ftsRank: r.rank,
        path: r.path,
        description: r.description,
        title: r.title,
        category: r.category,
        tags: r.tags,
      });
    }
  }

  // Vec results — already sorted by distance (lowest first = most similar)
  for (let i = 0; i < vecResults.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loop guard: i < length
    const r = vecResults[i]!;
    const rrfScore = vecWeight * (1.0 / (k + i + 1));
    const existing = scores.get(r.slug);
    if (existing) {
      existing.score += rrfScore;
      existing.vecDistance = r.distance;
    } else {
      scores.set(r.slug, {
        slug: r.slug,
        score: rrfScore,
        vecDistance: r.distance,
      });
    }
  }

  const CC_MEMORY_BOOST = 1.2;
  const results = Array.from(scores.values());
  for (const r of results) {
    if (r.category === 'cc-memory') r.score *= CC_MEMORY_BOOST;
  }
  return results.sort((a, b) => b.score - a.score);
}

// ── Search Functions ───────────────────────────────────────────────

export function searchFts5(
  db: Database,
  query: string,
  limit: number = 20,
  project?: string,
): FtsResult[] {
  const sanitized = query.replace(/["*(){}[\]^~:]/g, '').trim();
  if (!sanitized) return [];

  const terms = sanitized.split(/\s+/).map(t => `"${t}"`).join(' OR ');

  try {
    if (project) {
      return dbAll<FtsResult>(
        db,
        `SELECT slug, path, description, title, category, tags, rank
         FROM mindlore_fts
         WHERE mindlore_fts MATCH ? AND project = ?
         ORDER BY rank
         LIMIT ?`,
        terms, project, limit,
      );
    }
    return dbAll<FtsResult>(
      db,
      `SELECT slug, path, description, title, category, tags, rank
       FROM mindlore_fts
       WHERE mindlore_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      terms, limit,
    );
  } catch (_err) {
    return [];
  }
}

export function searchVec(
  db: Database,
  queryEmbedding: number[],
  limit: number = 20,
): VecResult[] {
  try {
    const buf = Buffer.from(new Float32Array(queryEmbedding).buffer);
    return dbAll<VecResult>(
      db,
      `SELECT slug, distance
       FROM documents_vec
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT ?`,
      buf, limit,
    );
  } catch (_err) {
    return [];
  }
}

/**
 * Main hybrid search entry point.
 * Falls back to pure FTS5 when vec table or embedding is not available.
 */
export function hybridSearch(
  db: Database,
  query: string,
  options: HybridSearchOptions = {},
): FusedResult[] {
  const maxResults = options.maxResults ?? 5;
  const ftsLimit = 20;
  const vecLimit = 20;

  // Always search FTS5
  const ftsResults = searchFts5(db, query, ftsLimit, options.project);

  // Try vec search if embedding is provided and vec table exists
  let vecResults: VecResult[] = [];
  if (options.queryEmbedding && hasVecTable(db)) {
    vecResults = searchVec(db, options.queryEmbedding, vecLimit);
  }

  // If no vec results, return FTS5 results directly
  if (vecResults.length === 0) {
    return ftsResults.slice(0, maxResults).map(r => ({
      slug: r.slug,
      score: normalizeBM25(r.rank),
      ftsRank: r.rank,
      path: r.path,
      description: r.description,
      title: r.title,
      category: r.category,
      tags: r.tags,
    }));
  }

  // Fuse results with RRF
  const fused = computeRRF(ftsResults, vecResults, {
    k: options.k,
    ftsWeight: options.ftsWeight,
    vecWeight: options.vecWeight,
  });

  return fused.slice(0, maxResults);
}
