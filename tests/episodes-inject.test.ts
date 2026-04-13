/**
 * Episodes injection + hook helper tests — v0.4.0
 * Tests session-focus episode injection and session-end bare episode writing.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { createTestDbWithEpisodes } from './helpers/db.js';

const {
  ensureEpisodesTable,
  hasEpisodesTable,
  insertBareEpisode,
  queryRecentEpisodes,
}: {
  ensureEpisodesTable: (db: Database.Database) => void;
  hasEpisodesTable: (db: Database.Database) => boolean;
  insertBareEpisode: (db: Database.Database, entry: Record<string, unknown>) => string;
  queryRecentEpisodes: (db: Database.Database, opts: Record<string, unknown>) => Array<Record<string, unknown>>;
} = require('../hooks/lib/mindlore-common.cjs');

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-inject-'));
  const dbPath = path.join(tmpDir, 'test.db');
  db = createTestDbWithEpisodes(dbPath);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('session-focus episode injection', () => {
  test('queryRecentEpisodes returns episodes ordered by created_at DESC', () => {
    // Insert with explicit timestamps to guarantee order
    db.prepare(`INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at)
      VALUES ('ep-1', 'session', 'project', 'mindlore', 'First session', 'active', 'hook', '2026-04-13T10:00:00.000Z')`).run();
    db.prepare(`INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at)
      VALUES ('ep-2', 'decision', 'project', 'mindlore', 'Chose SQLite', 'active', 'diary', '2026-04-13T11:00:00.000Z')`).run();
    db.prepare(`INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at)
      VALUES ('ep-3', 'learning', 'project', 'mindlore', 'Use ctx_execute_file', 'active', 'reflect', '2026-04-13T12:00:00.000Z')`).run();

    const episodes = queryRecentEpisodes(db, { project: 'mindlore', limit: 3 });
    expect(episodes).toHaveLength(3);
    // Most recent first
    expect(episodes[0]!.summary).toBe('Use ctx_execute_file');
    expect(episodes[2]!.summary).toBe('First session');
  });

  test('queryRecentEpisodes respects limit', () => {
    for (let i = 0; i < 5; i++) {
      insertBareEpisode(db, { kind: 'session', summary: `Session ${i}`, project: 'mindlore' });
    }

    const limited = queryRecentEpisodes(db, { project: 'mindlore', limit: 3 });
    expect(limited).toHaveLength(3);
  });

  test('queryRecentEpisodes filters by project', () => {
    insertBareEpisode(db, { kind: 'session', summary: 'Mindlore session', project: 'mindlore' });
    insertBareEpisode(db, { kind: 'session', summary: 'Kastell session', project: 'kastell' });

    const mindlore = queryRecentEpisodes(db, { project: 'mindlore' });
    expect(mindlore).toHaveLength(1);
    expect(mindlore[0]!.summary).toBe('Mindlore session');
  });

  test('queryRecentEpisodes only returns active episodes', () => {
    insertBareEpisode(db, { kind: 'session', summary: 'Active', project: 'mindlore' });
    insertBareEpisode(db, { kind: 'session', summary: 'Will delete', project: 'mindlore' });

    // Soft-delete second one
    db.prepare("UPDATE episodes SET status = 'deleted' WHERE summary = 'Will delete'").run();

    const episodes = queryRecentEpisodes(db, { project: 'mindlore' });
    expect(episodes).toHaveLength(1);
    expect(episodes[0]!.summary).toBe('Active');
  });

  test('episode summary format matches inject expectation', () => {
    insertBareEpisode(db, {
      kind: 'decision',
      summary: 'Type safety enforcement için as yerine helper pattern',
      project: 'mindlore',
      source: 'diary',
    });

    const episodes = queryRecentEpisodes(db, { project: 'mindlore', limit: 3 });
    const ep = episodes[0]!;

    // Verify shape matches what session-focus inject needs
    expect(ep).toHaveProperty('kind');
    expect(ep).toHaveProperty('summary');
    expect(ep).toHaveProperty('created_at');

    // Format like session-focus would
    const date = String(ep['created_at']).slice(0, 10);
    const line = `- [${date}] ${ep['kind']}: ${String(ep['summary']).slice(0, 100)}`;
    expect(line).toContain('decision');
    expect(line).toContain('Type safety');
  });
});

describe('session-end bare episode', () => {
  test('insertBareEpisode creates session episode with commit info', () => {
    const commits = ['abc1234 feat: add episodes', 'def5678 fix: type error'];
    const files = ['scripts/lib/episodes.ts', 'tests/episodes.test.ts'];

    const summary = `Session: ${commits.join(', ')} (${files.length} files)`.slice(0, 300);
    const body = [
      '## Commits\n' + commits.map(c => `- ${c}`).join('\n'),
      '## Changed Files\n' + files.map(f => `- ${f}`).join('\n'),
    ].join('\n\n');

    const id = insertBareEpisode(db, {
      kind: 'session',
      scope: 'project',
      project: 'mindlore',
      summary,
      body,
      tags: 'session',
      entities: files,
      source: 'hook',
    });

    expect(id).toMatch(/^ep-/);

    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as Record<string, unknown>;
    expect(ep.kind).toBe('session');
    expect(ep.source).toBe('hook');
    expect(ep.project).toBe('mindlore');
    expect(String(ep.body)).toContain('## Commits');
    expect(String(ep.body)).toContain('episodes.ts');

    const entities = JSON.parse(String(ep.entities));
    expect(entities).toEqual(files);
  });

  test('bare episode with no commits', () => {
    const id = insertBareEpisode(db, {
      kind: 'session',
      project: 'mindlore',
      summary: 'Session: no commits (0 files)',
      source: 'hook',
    });

    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as Record<string, unknown>;
    expect(ep.summary).toBe('Session: no commits (0 files)');
    expect(ep.entities).toBeNull();
  });

  test('bare episode with read stats in body', () => {
    const body = '## Read Stats\n- 15 files read, 3 repeated';
    const id = insertBareEpisode(db, {
      kind: 'session',
      project: 'mindlore',
      summary: 'Session with reads',
      body,
      source: 'hook',
    });

    const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as Record<string, unknown>;
    expect(String(ep.body)).toContain('15 files read');
  });
});

describe('episodes table migration', () => {
  test('ensureEpisodesTable on fresh DB creates table', () => {
    const freshPath = path.join(tmpDir, 'fresh.db');
    const freshDb = new Database(freshPath);
    freshDb.pragma('journal_mode = WAL');

    expect(hasEpisodesTable(freshDb)).toBe(false);
    ensureEpisodesTable(freshDb);
    expect(hasEpisodesTable(freshDb)).toBe(true);

    // Can insert after creation
    const id = insertBareEpisode(freshDb, { kind: 'session', summary: 'Test', project: 'test' });
    expect(id).toMatch(/^ep-/);

    freshDb.close();
  });

  test('ensureEpisodesTable is idempotent on existing table', () => {
    ensureEpisodesTable(db);
    ensureEpisodesTable(db);

    // Data still intact
    insertBareEpisode(db, { kind: 'session', summary: 'Before', project: 'test' });
    ensureEpisodesTable(db);

    const rows = queryRecentEpisodes(db, { project: 'test' });
    expect(rows).toHaveLength(1);
  });
});
