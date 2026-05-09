import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

import { SYMMETRIC_TYPES, buildPriorityCase, RELATED_OVERFETCH } from './constants.js';
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

const symmetricPlaceholders = Array.from(SYMMETRIC_TYPES).map(() => '?').join(',');
const symmetricValues = [...SYMMETRIC_TYPES];
const priorityCaseExpr = buildPriorityCase();
const RELATIONS_SQL = `
  SELECT * FROM (
    SELECT source_b AS source, relation_type, 'outgoing' AS direction
    FROM mindlore_relations WHERE source_a = ?
    UNION ALL
    SELECT source_a AS source, relation_type, 'incoming' AS direction
    FROM mindlore_relations WHERE source_b = ? AND relation_type IN (${symmetricPlaceholders})
  )
  ORDER BY CASE relation_type ${priorityCaseExpr} END
  LIMIT ?
`;

export function getRelationsForSlug(db: Database, slug: string, limit = RELATED_OVERFETCH): RelatedSource[] {
  return dbAll<RelatedSource>(db, RELATIONS_SQL, slug, slug, ...symmetricValues, limit);
}
