/**
 * Episodes CRUD tests — v0.4.0 episodic memory.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  createEpisode,
  getEpisode,
  queryEpisodes,
  supersede,
  deleteEpisode,
  countEpisodes,
  mirrorToFts,
  ensureEpisodesTable,
  hasEpisodesTable,
} from '../scripts/lib/episodes.js';
// Episode type used implicitly via createEpisode return values
import { createTestDbWithEpisodes } from './helpers/db.js';
import Database from 'better-sqlite3';

let db: Database.Database;
let dbPath: string;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-episodes-'));
  dbPath = path.join(tmpDir, 'test.db');
  db = createTestDbWithEpisodes(dbPath);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('episodes table', () => {
  test('hasEpisodesTable returns true after creation', () => {
    expect(hasEpisodesTable(db)).toBe(true);
  });

  test('hasEpisodesTable returns false on fresh db', () => {
    const freshPath = path.join(tmpDir, 'fresh.db');
    const freshDb = new Database(freshPath);
    expect(hasEpisodesTable(freshDb)).toBe(false);
    freshDb.close();
  });

  test('ensureEpisodesTable is idempotent', () => {
    ensureEpisodesTable(db);
    ensureEpisodesTable(db);
    expect(hasEpisodesTable(db)).toBe(true);
  });
});

describe('createEpisode', () => {
  test('creates episode with minimal input', () => {
    const ep = createEpisode(db, {
      kind: 'session',
      summary: 'Test session episode',
    });

    expect(ep.id).toMatch(/^ep-/);
    expect(ep.kind).toBe('session');
    expect(ep.scope).toBe('project');
    expect(ep.summary).toBe('Test session episode');
    expect(ep.status).toBe('active');
    expect(ep.source).toBe('manual');
    expect(ep.created_at).toBeTruthy();
  });

  test('creates episode with all fields', () => {
    const ep = createEpisode(db, {
      kind: 'decision',
      summary: 'Chose SQLite over JSONL',
      scope: 'global',
      project: 'mindlore',
      body: '## Reason\nBetter query support.',
      tags: 'architecture, storage',
      entities: ['scripts/lib/episodes.ts', 'mindlore.db'],
      parent_id: null,
      source: 'diary',
    });

    expect(ep.kind).toBe('decision');
    expect(ep.scope).toBe('global');
    expect(ep.project).toBe('mindlore');
    expect(ep.body).toContain('Reason');
    expect(ep.tags).toBe('architecture, storage');
    expect(JSON.parse(ep.entities!)).toEqual(['scripts/lib/episodes.ts', 'mindlore.db']);
    expect(ep.source).toBe('diary');
  });

  test('generates unique IDs', () => {
    const ep1 = createEpisode(db, { kind: 'event', summary: 'Event 1' });
    const ep2 = createEpisode(db, { kind: 'event', summary: 'Event 2' });
    expect(ep1.id).not.toBe(ep2.id);
  });
});

describe('getEpisode', () => {
  test('retrieves existing episode', () => {
    const created = createEpisode(db, { kind: 'learning', summary: 'Learned X' });
    const fetched = getEpisode(db, created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.summary).toBe('Learned X');
  });

  test('returns undefined for non-existent ID', () => {
    expect(getEpisode(db, 'ep-nonexistent')).toBeUndefined();
  });
});

describe('queryEpisodes', () => {
  beforeEach(() => {
    createEpisode(db, { kind: 'session', summary: 'Session 1', project: 'mindlore', source: 'hook' });
    createEpisode(db, { kind: 'decision', summary: 'Decision 1', project: 'mindlore', source: 'diary' });
    createEpisode(db, { kind: 'session', summary: 'Session 2', project: 'kastell', source: 'hook' });
    createEpisode(db, { kind: 'learning', summary: 'Learning 1', scope: 'global', source: 'reflect' });
  });

  test('returns all active episodes by default', () => {
    const results = queryEpisodes(db);
    expect(results).toHaveLength(4);
  });

  test('filters by kind', () => {
    const sessions = queryEpisodes(db, { kind: 'session' });
    expect(sessions).toHaveLength(2);
    expect(sessions.every(e => e.kind === 'session')).toBe(true);
  });

  test('filters by project', () => {
    const mindlore = queryEpisodes(db, { project: 'mindlore' });
    expect(mindlore).toHaveLength(2);
  });

  test('filters by scope', () => {
    const globals = queryEpisodes(db, { scope: 'global' });
    expect(globals).toHaveLength(1);
    expect(globals[0]!.summary).toBe('Learning 1');
  });

  test('filters by source', () => {
    const hooks = queryEpisodes(db, { source: 'hook' });
    expect(hooks).toHaveLength(2);
  });

  test('respects limit', () => {
    const limited = queryEpisodes(db, { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  test('orders by created_at DESC', () => {
    const all = queryEpisodes(db);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]!.created_at >= all[i]!.created_at).toBe(true);
    }
  });

  test('filters by since date', () => {
    const future = queryEpisodes(db, { since: '2099-01-01T00:00:00.000Z' });
    expect(future).toHaveLength(0);

    const past = queryEpisodes(db, { since: '2020-01-01T00:00:00.000Z' });
    expect(past).toHaveLength(4);
  });
});

describe('supersede', () => {
  test('marks old episode as superseded and links new one', () => {
    const old = createEpisode(db, { kind: 'decision', summary: 'Use JSONL' });
    const newer = supersede(db, old.id, { kind: 'decision', summary: 'Use SQLite' });

    expect(newer.supersedes).toBe(old.id);
    expect(newer.status).toBe('active');

    const oldRefresh = getEpisode(db, old.id);
    expect(oldRefresh!.status).toBe('superseded');
  });

  test('superseded episodes excluded from default query', () => {
    const old = createEpisode(db, { kind: 'decision', summary: 'Old decision' });
    supersede(db, old.id, { kind: 'decision', summary: 'New decision' });

    const active = queryEpisodes(db, { kind: 'decision' });
    expect(active).toHaveLength(1);
    expect(active[0]!.summary).toBe('New decision');
  });
});

describe('deleteEpisode', () => {
  test('soft-deletes an episode', () => {
    const ep = createEpisode(db, { kind: 'event', summary: 'To delete' });
    const result = deleteEpisode(db, ep.id);
    expect(result).toBe(true);

    const deleted = getEpisode(db, ep.id);
    expect(deleted!.status).toBe('deleted');
  });

  test('returns false for already deleted', () => {
    const ep = createEpisode(db, { kind: 'event', summary: 'Double delete' });
    deleteEpisode(db, ep.id);
    expect(deleteEpisode(db, ep.id)).toBe(false);
  });

  test('deleted episodes excluded from default query', () => {
    const ep = createEpisode(db, { kind: 'event', summary: 'Deleted event' });
    deleteEpisode(db, ep.id);

    const results = queryEpisodes(db);
    expect(results).toHaveLength(0);
  });
});

describe('countEpisodes', () => {
  test('counts all active episodes', () => {
    createEpisode(db, { kind: 'session', summary: 'S1' });
    createEpisode(db, { kind: 'session', summary: 'S2' });
    expect(countEpisodes(db)).toBe(2);
  });

  test('counts by project', () => {
    createEpisode(db, { kind: 'session', summary: 'S1', project: 'mindlore' });
    createEpisode(db, { kind: 'session', summary: 'S2', project: 'kastell' });
    expect(countEpisodes(db, 'mindlore')).toBe(1);
  });

  test('excludes deleted episodes', () => {
    const ep = createEpisode(db, { kind: 'session', summary: 'S1' });
    createEpisode(db, { kind: 'session', summary: 'S2' });
    deleteEpisode(db, ep.id);
    expect(countEpisodes(db)).toBe(1);
  });
});

describe('mirrorToFts', () => {
  test('calls insertFn with correct FTS5 entry shape', () => {
    const ep = createEpisode(db, {
      kind: 'decision',
      summary: 'Use SQLite',
      body: 'Better queries',
      tags: 'architecture',
      project: 'mindlore',
    });

    const calls: Array<Record<string, unknown>> = [];
    const mockInsert = (_db: Database.Database, entry: Record<string, unknown>) => {
      calls.push(entry);
    };

    mirrorToFts(db, ep, mockInsert);

    expect(calls).toHaveLength(1);
    const entry = calls[0]!;
    expect(entry.type).toBe('episode');
    expect(entry.category).toBe('episodes');
    expect(entry.slug).toBe(`ep-${ep.id}`);
    expect(entry.title).toBe('Use SQLite');
    expect(entry.content).toContain('Use SQLite');
    expect(entry.content).toContain('Better queries');
    expect(entry.tags).toContain('decision');
    expect(entry.tags).toContain('architecture');
    expect(entry.project).toBe('mindlore');
  });
});

describe('hook helpers (CJS)', () => {
  // Test the CJS module functions used by hooks
  const {
    insertBareEpisode,
    queryRecentEpisodes,
    generateEpisodeId,
  }: {
    insertBareEpisode: (db: Database.Database, entry: Record<string, unknown>) => string;
    queryRecentEpisodes: (db: Database.Database, opts: Record<string, unknown>) => Array<Record<string, unknown>>;
    generateEpisodeId: () => string;
  } = require('../hooks/lib/mindlore-common.cjs');

  test('generateEpisodeId returns ep- prefixed string', () => {
    const id = generateEpisodeId();
    expect(id).toMatch(/^ep-[a-z0-9]+-[a-f0-9]{12}$/);
  });

  test('insertBareEpisode writes to DB', () => {
    const id = insertBareEpisode(db, {
      kind: 'session',
      summary: 'Bare session from hook',
      project: 'mindlore',
      source: 'hook',
    });

    expect(id).toMatch(/^ep-/);
    const ep = getEpisode(db, id);
    expect(ep).toBeDefined();
    expect(ep!.summary).toBe('Bare session from hook');
    expect(ep!.source).toBe('hook');
  });

  test('queryRecentEpisodes returns latest N episodes', () => {
    insertBareEpisode(db, { kind: 'session', summary: 'S1', project: 'mindlore' });
    insertBareEpisode(db, { kind: 'decision', summary: 'D1', project: 'mindlore' });
    insertBareEpisode(db, { kind: 'session', summary: 'S2', project: 'kastell' });

    const recent = queryRecentEpisodes(db, { project: 'mindlore', limit: 2 });
    expect(recent).toHaveLength(2);
    expect(recent[0]).toHaveProperty('kind');
    expect(recent[0]).toHaveProperty('summary');
    expect(recent[0]).toHaveProperty('created_at');
  });

  test('queryRecentEpisodes respects project filter', () => {
    insertBareEpisode(db, { kind: 'session', summary: 'S1', project: 'mindlore' });
    insertBareEpisode(db, { kind: 'session', summary: 'S2', project: 'kastell' });

    const mindlore = queryRecentEpisodes(db, { project: 'mindlore' });
    expect(mindlore).toHaveLength(1);
  });
});
