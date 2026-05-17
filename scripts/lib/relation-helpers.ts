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

export interface RelatedSource {
  source: string;
  relation_type: string;
  direction: 'outgoing' | 'incoming';
}

const RELATIONS_SQL = `
  SELECT source_b AS source, relation_type, 'outgoing' AS direction
  FROM mindlore_relations
  WHERE source_a = ?
  ORDER BY CASE relation_type ${PRIORITY_CASE} END
  LIMIT ?
`;

export function getRelationsForSlug(db: Database, slug: string, limit = RELATED_OVERFETCH): RelatedSource[] {
  return dbAll<RelatedSource>(db, RELATIONS_SQL, slug, limit);
}

interface BatchRelationRow {
  query_slug: string;
  source: string;
  relation_type: string;
  direction: string;
}

export function getRecallCountsForSlugs(
  db: Database,
  slugs: string[]
): Map<string, number> {
  if (slugs.length === 0) return new Map();
  const placeholders = slugs.map(() => '?').join(',');
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
  const placeholders = slugs.map(() => '?').join(',');

  const outgoing = dbAll<BatchRelationRow>(db, `
    SELECT source_a AS query_slug, source_b AS source, relation_type, 'outgoing' AS direction
    FROM mindlore_relations
    WHERE source_a IN (${placeholders})
    ORDER BY CASE relation_type ${PRIORITY_CASE} END
  `, ...slugs);

  const incoming = dbAll<BatchRelationRow>(db, `
    SELECT source_b AS query_slug, source_a AS source, relation_type, 'incoming' AS direction
    FROM mindlore_relations
    WHERE source_b IN (${placeholders})
    ORDER BY CASE relation_type ${PRIORITY_CASE} END
  `, ...slugs);

  // Shared dedup map across all slugs in this query call
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

  for (const row of outgoing) {
    const key = dedupKey(row.query_slug, row.source, row.relation_type);
    if (!seen.has(key)) {
      seen.set(key, {
        owner: row.query_slug,
        rel: { source: row.source, relation_type: row.relation_type, direction: 'outgoing' },
      });
    }
  }
  for (const row of incoming) {
    const key = dedupKey(row.query_slug, row.source, row.relation_type);
    if (!seen.has(key)) {
      seen.set(key, {
        owner: row.query_slug,
        rel: { source: row.source, relation_type: row.relation_type, direction: 'incoming' },
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
