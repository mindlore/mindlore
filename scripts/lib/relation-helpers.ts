import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

import { PRIORITY_CASE, RELATED_OVERFETCH, SYMMETRIC_TYPES } from './constants.js';
import { dbGet, dbAll } from './db-helpers.js';

export interface SourceRow {
  path: string;
  title: string;
}

export function assertSlugExists(db: Database, slug: string): SourceRow {
  const row = dbGet<SourceRow>(db, 'SELECT path, title FROM mindlore_fts WHERE slug = ? LIMIT 1', slug);
  if (!row) throw new Error(`Source slug "${slug}" not found in knowledge base`);
  return row;
}

// Fix #2: Stringly-typed direction — type alias + named constants
export type RelationDirection = 'outgoing' | 'incoming';
const DIRECTION_OUTGOING: RelationDirection = 'outgoing';
const DIRECTION_INCOMING: RelationDirection = 'incoming';

export interface RelatedSource {
  source: string;
  relation_type: string;
  direction: RelationDirection;
}

// Fix #1: DRY placeholder builder
const sqlPlaceholders = (n: number): string => Array(n).fill('?').join(',');

// Fix #3+4: Single UNION ALL query used by both batch and single-slug functions.
// ORDER BY must wrap UNION ALL in a subquery — SQLite cannot sort UNION by expression directly.
const buildRelationsUnionSql = (n: number): string => `
  SELECT * FROM (
    SELECT source_a AS query_slug, source_b AS source, relation_type, '${DIRECTION_OUTGOING}' AS direction
    FROM mindlore_relations
    WHERE source_a IN (${sqlPlaceholders(n)})
    UNION ALL
    SELECT source_b AS query_slug, source_a AS source, relation_type, '${DIRECTION_INCOMING}' AS direction
    FROM mindlore_relations
    WHERE source_b IN (${sqlPlaceholders(n)})
  )
  ORDER BY CASE relation_type ${PRIORITY_CASE} END
`;

interface BatchRelationRow {
  query_slug: string;
  source: string;
  relation_type: string;
  direction: RelationDirection;
}

// Fix #4: Single-slug delegates to batch — single source of truth
export function getRelationsForSlug(db: Database, slug: string, limit = RELATED_OVERFETCH): RelatedSource[] {
  const batchResult = getRelationsForSlugs(db, [slug]);
  const rels = batchResult.get(slug) ?? [];
  return rels.slice(0, limit);
}

export function getRecallCountsForSlugs(
  db: Database,
  slugs: string[]
): Map<string, number> {
  if (slugs.length === 0) return new Map();
  // Fix #1: use shared sqlPlaceholders helper
  const placeholders = sqlPlaceholders(slugs.length);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
  const rows = db.prepare(`
    SELECT f.slug, h.recall_count
    FROM file_hashes h
    JOIN mindlore_fts f ON f.path = h.path
    WHERE f.slug IN (${placeholders}) AND h.recall_count > 0
  `).all(...slugs) as Array<{ slug: string; recall_count: number }>;
  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(row.slug, row.recall_count);
  }
  return result;
}

export function getRelationsForSlugs(db: Database, slugs: string[]): Map<string, RelatedSource[]> {
  if (slugs.length === 0) return new Map();

  // Fix #3: Single UNION ALL query — halves DB round-trips
  const rows = dbAll<BatchRelationRow>(db, buildRelationsUnionSql(slugs.length), ...slugs, ...slugs);

  interface SeenEntry { owner: string; rel: RelatedSource }
  const seen = new Map<string, SeenEntry>();
  const isSymmetric = (type: string): boolean => (SYMMETRIC_TYPES as Set<string>).has(type);
  const dedupKey = (slug: string, related: string, type: string): string => {
    if (isSymmetric(type)) {
      const [a, b] = [slug, related].sort();
      return `${a}|${b}|${type}`;
    }
    return `${slug}|${related}|${type}`;
  };

  for (const row of rows) {
    const key = dedupKey(row.query_slug, row.source, row.relation_type);
    if (!seen.has(key)) {
      seen.set(key, {
        owner: row.query_slug,
        rel: { source: row.source, relation_type: row.relation_type, direction: row.direction },
      });
    }
  }

  const result = new Map<string, RelatedSource[]>();
  for (const s of slugs) result.set(s, []);
  for (const entry of seen.values()) {
    const bucket = result.get(entry.owner);
    if (bucket) bucket.push(entry.rel);
  }
  return result;
}
