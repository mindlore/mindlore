/**
 * Episodes CRUD helpers for Mindlore episodic memory.
 * v0.4.0: session/decision/event/preference/learning/friction/discovery episodes.
 *
 * Episodes live in a regular SQLite table (not FTS5) for structured queries.
 * Optionally mirrored to FTS5 for text search.
 */

import crypto from 'crypto';
import type BetterSqlite3 from 'better-sqlite3';
import { dbGet, dbAll } from './db-helpers.js';

type Database = BetterSqlite3.Database;

// ── Types ────────────────────────────────────────────────────────────

export const EPISODE_KINDS = ['session', 'decision', 'event', 'preference', 'learning', 'friction', 'discovery'] as const;
export type EpisodeKind = typeof EPISODE_KINDS[number];

export const EPISODE_SCOPES = ['project', 'global'] as const;
export type EpisodeScope = typeof EPISODE_SCOPES[number];

export const EPISODE_STATUSES = ['active', 'superseded', 'deleted'] as const;
export type EpisodeStatus = typeof EPISODE_STATUSES[number];

export const EPISODE_SOURCES = ['hook', 'diary', 'reflect', 'decide', 'manual'] as const;
export type EpisodeSource = typeof EPISODE_SOURCES[number];

export interface Episode {
  [key: string]: unknown;  // index signature for dbGet/dbAll compatibility
  id: string;
  kind: EpisodeKind;
  scope: EpisodeScope;
  project: string | null;
  summary: string;
  body: string | null;
  tags: string | null;
  entities: string | null;  // JSON array string
  parent_id: string | null;
  status: EpisodeStatus;
  supersedes: string | null;
  source: EpisodeSource;
  created_at: string;
}

export interface CreateEpisodeInput {
  kind: EpisodeKind;
  summary: string;
  scope?: EpisodeScope;
  project?: string | null;
  body?: string | null;
  tags?: string | null;
  entities?: string[] | null;
  parent_id?: string | null;
  supersedes?: string | null;
  source?: EpisodeSource;
}

export interface QueryEpisodesOptions {
  kind?: EpisodeKind;
  scope?: EpisodeScope;
  project?: string | null;
  status?: EpisodeStatus;
  source?: EpisodeSource;
  limit?: number;
  since?: string;  // ISO 8601 date
}

// ── SQL ──────────────────────────────────────────────────────────────
// CO-EVOLUTION: Schema mirrors SQL_EPISODES_CREATE + SQL_EPISODES_INDEXES in hooks/lib/mindlore-common.cjs
// CJS hooks cannot import TS modules; keep both in sync on schema changes.

export const SQL_EPISODES_CREATE = `
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'project',
  project TEXT,
  summary TEXT NOT NULL,
  body TEXT,
  tags TEXT,
  entities TEXT,
  parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  supersedes TEXT,
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_episodes_kind ON episodes(kind, status);
CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project, status);
CREATE INDEX IF NOT EXISTS idx_episodes_created ON episodes(created_at DESC);
`;

// ── Helpers ──────────────────────────────────────────────────────────

// CO-EVOLUTION: generateId mirrors generateEpisodeId in hooks/lib/mindlore-common.cjs
// CJS hooks cannot import TS modules; keep both in sync on schema changes.
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `ep-${timestamp}-${random}`;
}

// ── CRUD ─────────────────────────────────────────────────────────────

export function createEpisode(db: Database, input: CreateEpisodeInput): Episode {
  const id = generateId();
  const now = new Date().toISOString();
  const entities = input.entities ? JSON.stringify(input.entities) : null;

  db.prepare(`
    INSERT INTO episodes (id, kind, scope, project, summary, body, tags, entities, parent_id, status, supersedes, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    id,
    input.kind,
    input.scope ?? 'project',
    input.project ?? null,
    input.summary,
    input.body ?? null,
    input.tags ?? null,
    entities,
    input.parent_id ?? null,
    input.supersedes ?? null,
    input.source ?? 'manual',
    now,
  );

  // If superseding, mark old episode
  if (input.supersedes) {
    db.prepare(`UPDATE episodes SET status = 'superseded' WHERE id = ?`).run(input.supersedes);
  }

  return {
    id,
    kind: input.kind,
    scope: input.scope ?? 'project',
    project: input.project ?? null,
    summary: input.summary,
    body: input.body ?? null,
    tags: input.tags ?? null,
    entities,
    parent_id: input.parent_id ?? null,
    status: 'active',
    supersedes: input.supersedes ?? null,
    source: input.source ?? 'manual',
    created_at: now,
  };
}

export function getEpisode(db: Database, id: string): Episode | undefined {
  return dbGet<Episode>(db, 'SELECT * FROM episodes WHERE id = ?', id);
}

export function queryEpisodes(db: Database, opts: QueryEpisodesOptions = {}): Episode[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.kind) {
    conditions.push('kind = ?');
    params.push(opts.kind);
  }
  if (opts.scope) {
    conditions.push('scope = ?');
    params.push(opts.scope);
  }
  if (opts.project !== undefined) {
    if (opts.project === null) {
      conditions.push('project IS NULL');
    } else {
      conditions.push('project = ?');
      params.push(opts.project);
    }
  }
  if (opts.status) {
    conditions.push('status = ?');
    params.push(opts.status);
  } else {
    // Default: only active
    conditions.push("status = 'active'");
  }
  if (opts.source) {
    conditions.push('source = ?');
    params.push(opts.source);
  }
  if (opts.since) {
    conditions.push('created_at >= ?');
    params.push(opts.since);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit ?? 50;

  return dbAll<Episode>(db, `SELECT * FROM episodes ${where} ORDER BY created_at DESC LIMIT ?`, ...params, limit);
}

export function supersede(db: Database, oldId: string, newInput: CreateEpisodeInput): Episode {
  return createEpisode(db, { ...newInput, supersedes: oldId });
}

export function deleteEpisode(db: Database, id: string): boolean {
  const result = db.prepare(`UPDATE episodes SET status = 'deleted' WHERE id = ? AND status != 'deleted'`).run(id);
  return result.changes > 0;
}

export function countEpisodes(db: Database, project?: string): number {
  if (project) {
    const row = dbGet<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM episodes WHERE project = ? AND status = 'active'", project);
    return row?.cnt ?? 0;
  }
  const row = dbGet<{ cnt: number }>(db, "SELECT COUNT(*) as cnt FROM episodes WHERE status = 'active'");
  return row?.cnt ?? 0;
}

// ── FTS5 Mirror ──────────────────────────────────────────────────────

export function mirrorToFts(
  db: Database,
  episode: Episode,
  insertFn: (db: Database, entry: Record<string, unknown>) => void,
): void {
  insertFn(db, {
    path: `episodes/${episode.id}`,
    slug: `ep-${episode.id}`,
    description: episode.summary,
    type: 'episode',
    category: 'episodes',
    title: episode.summary,
    content: [episode.summary, episode.body ?? ''].join('\n').trim(),
    tags: [episode.kind, episode.tags ?? ''].filter(Boolean).join(', '),
    quality: null,
    dateCaptured: episode.created_at,
    project: episode.project,
  });
}

// ── Table Check ──────────────────────────────────────────────────────

export function ensureEpisodesTable(db: Database): void {
  // Split the SQL since it contains multiple statements
  const statements = SQL_EPISODES_CREATE
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    db.exec(stmt);
  }
}

export function hasEpisodesTable(db: Database): boolean {
  const row = dbGet<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name='episodes'",
  );
  return row !== undefined;
}
