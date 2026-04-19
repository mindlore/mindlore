import type BetterSqlite3 from 'better-sqlite3';
import { dbAll } from './db-helpers.js';
import { DECAY_HALF_LIFE_DAYS, STALE_THRESHOLD } from './constants.js';

type Database = BetterSqlite3.Database;

export interface DecayConfig {
  halfLifeDays?: number;
  staleThreshold?: number;
}

interface DecayInput {
  created_at: string;
  last_recalled_at: string | null;
  recall_count: number;
  importance: number;
}

interface StaleDocument {
  path: string;
  decay_score: number;
  recall_count: number;
  last_recalled_at: string | null;
  created_at: string;
}

export function calculateDecayScore(input: DecayInput, config?: DecayConfig): number {
  const halfLife = config?.halfLifeDays ?? DECAY_HALF_LIFE_DAYS;
  const now = Date.now();
  const lastAccess = input.last_recalled_at
    ? new Date(input.last_recalled_at).getTime()
    : new Date(input.created_at).getTime();

  const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);
  const timeDecay = Math.pow(0.5, daysSinceAccess / halfLife);
  const accessBoost = Math.min(1.0, Math.log2(input.recall_count + 1) / 5);
  const score = (timeDecay * 0.6 + accessBoost * 0.4) * input.importance;

  return Math.max(0, Math.min(1.0, score));
}

export function archiveDocument(db: Database, filePath: string): void {
  db.prepare(
    'UPDATE file_hashes SET archived_at = ? WHERE path = ?'
  ).run(new Date().toISOString(), filePath);
}

export function restoreDocument(db: Database, filePath: string): void {
  db.prepare(
    'UPDATE file_hashes SET archived_at = NULL WHERE path = ?'
  ).run(filePath);
}

export function listStaleDocuments(db: Database, threshold?: number, config?: DecayConfig): StaleDocument[] {
  const effectiveThreshold = threshold ?? config?.staleThreshold ?? STALE_THRESHOLD;
  const rows = dbAll<{
    path: string;
    recall_count: number;
    last_recalled_at: string | null;
    last_indexed: string;
    importance: number;
  }>(db, `
    SELECT path, recall_count, last_recalled_at, last_indexed,
           COALESCE(importance, 1.0) as importance
    FROM file_hashes
    WHERE archived_at IS NULL
      AND path NOT LIKE '%MEMORY.md'
      AND path NOT LIKE '%INDEX.md'
  `);

  const stale: StaleDocument[] = [];
  for (const row of rows) {
    const created_at = row.last_indexed ?? new Date().toISOString();
    const score = calculateDecayScore({
      created_at,
      last_recalled_at: row.last_recalled_at,
      recall_count: row.recall_count ?? 0,
      importance: row.importance,
    }, config);
    if (score < effectiveThreshold) {
      stale.push({ ...row, decay_score: score, created_at });
    }
  }

  return stale.sort((a, b) => a.decay_score - b.decay_score);
}

export function persistDecayScores(db: Database): number {
  const episodes = dbAll<{ id: string; created_at: string; kind: string }>(
    db,
    "SELECT id, created_at, kind FROM episodes WHERE status = 'active'"
  );

  const now = new Date().toISOString();
  const update = db.prepare(
    'UPDATE episodes SET decay_score = ?, last_decay_calc = ? WHERE id = ?'
  );

  let count = 0;
  for (const ep of episodes) {
    const importance = ep.kind === 'decision' ? 0.9
      : ep.kind === 'learning' ? 0.8
      : 0.5;
    const score = calculateDecayScore({
      created_at: ep.created_at,
      last_recalled_at: null,
      recall_count: 0,
      importance,
    });
    update.run(score, now, ep.id);
    count++;
  }
  return count;
}
