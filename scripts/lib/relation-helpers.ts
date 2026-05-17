import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

import { PRIORITY_CASE, RELATED_OVERFETCH } from './constants.js';
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

export function getRelationsForSlugs(db: Database, slugs: string[]): Map<string, RelatedSource[]> {
  const result = new Map<string, RelatedSource[]>();
  if (slugs.length === 0) return result;
  for (const s of slugs) result.set(s, []);

  const placeholders = slugs.map(() => '?').join(',');
  const sql = `
    SELECT source_a AS query_slug, source_b AS source, relation_type, 'outgoing' AS direction
    FROM mindlore_relations
    WHERE source_a IN (${placeholders})
    ORDER BY CASE relation_type ${PRIORITY_CASE} END
  `;
  const rows = dbAll<BatchRelationRow>(db, sql, ...slugs);
  for (const row of rows) {
    const bucket = result.get(row.query_slug);
    if (bucket) bucket.push({ source: row.source, relation_type: row.relation_type, direction: 'outgoing' });
  }
  return result;
}
