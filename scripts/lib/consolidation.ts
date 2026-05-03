import type BetterSqlite3 from 'better-sqlite3';
import { dbAll, dbGet } from './db-helpers.js';
import { CONSOLIDATION_THRESHOLD } from './constants.js';
import type { EpisodeKind } from './episodes.js';

type Database = BetterSqlite3.Database;

interface RawEpisode {
  id: string;
  kind: EpisodeKind;
  summary: string;
  body: string | null;
  tags: string | null;
  created_at: string;
}

export function countRawEpisodes(db: Database): number {
  const row = dbGet<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM episodes WHERE consolidation_status = 'raw' OR consolidation_status IS NULL");
  return row?.cnt ?? 0;
}

export function needsConsolidation(db: Database, threshold: number = CONSOLIDATION_THRESHOLD): boolean {
  return countRawEpisodes(db) >= threshold;
}

export function groupEpisodesByKind(db: Database): Map<EpisodeKind, RawEpisode[]> {
  const rows = dbAll<RawEpisode>(db, `
    SELECT id, kind, summary, body, tags, created_at
    FROM episodes
    WHERE (consolidation_status = 'raw' OR consolidation_status IS NULL) AND status = 'active'
    ORDER BY kind, created_at
  `);

  const groups = new Map<EpisodeKind, RawEpisode[]>();
  for (const row of rows) {
    const list = groups.get(row.kind) ?? [];
    list.push(row);
    groups.set(row.kind, list);
  }
  return groups;
}

const KIND_DIR_MAP: Partial<Record<EpisodeKind, string>> = {
  learning: 'learnings',
  discovery: 'insights',
  friction: 'analyses',
  decision: 'decisions',
};

export function resolveTargetDir(kind: EpisodeKind): string {
  return KIND_DIR_MAP[kind] ?? 'learnings';
}

export function markConsolidated(db: Database, episodeIds: string[], targetFile: string): void {
  const stmt = db.prepare(`
    UPDATE episodes
    SET consolidation_status = 'consolidated',
        consolidated_into = ?
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const id of episodeIds) {
      stmt.run(targetFile, id);
    }
  });
  transaction();
}
