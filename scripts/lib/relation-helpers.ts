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
