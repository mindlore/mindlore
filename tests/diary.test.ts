/**
 * Diary mode tests — v0.4.0 episode extraction.
 * Tests the diary workflow: find bare session → extract enriched episodes.
 */

import Database from 'better-sqlite3';
import { createEpisodesTestEnv, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';
import {
  createEpisode,
  queryEpisodes,
  EPISODE_KINDS,
} from '../scripts/lib/episodes.js';
import type { EpisodeKind } from '../scripts/lib/episodes.js';

const {
  insertBareEpisode,
  queryRecentEpisodes,
}: {
  insertBareEpisode: (db: Database.Database, entry: Record<string, unknown>) => string;
  queryRecentEpisodes: (db: Database.Database, opts: Record<string, unknown>) => Array<Record<string, unknown>>;
} = require('../hooks/lib/mindlore-common.cjs');

let env: EpisodesTestEnv;
let db: Database.Database;

beforeEach(() => {
  env = createEpisodesTestEnv('diary');
  db = env.db;
});

afterEach(() => {
  destroyEpisodesTestEnv(env);
});

describe('episode kinds', () => {
  test('includes friction and discovery', () => {
    expect(EPISODE_KINDS).toContain('friction');
    expect(EPISODE_KINDS).toContain('discovery');
  });

  test('all 9 kinds are present', () => {
    expect(EPISODE_KINDS).toHaveLength(9);
    expect([...EPISODE_KINDS]).toEqual([
      'session', 'decision', 'event', 'preference', 'learning', 'friction', 'discovery', 'nomination', 'session-summary',
    ]);
  });

  test('can create episodes with friction kind', () => {
    const ep = createEpisode(db, {
      kind: 'friction',
      summary: 'PostToolUse stdout hook output goes to debug log',
      source: 'diary',
      project: 'mindlore',
    });
    expect(ep.kind).toBe('friction');
    expect(ep.status).toBe('active');
  });

  test('can create episodes with discovery kind', () => {
    const ep = createEpisode(db, {
      kind: 'discovery',
      summary: 'PostToolUse if koşulu CC dispatcher tarafından değerlendirilmiyor',
      source: 'diary',
      project: 'mindlore',
    });
    expect(ep.kind).toBe('discovery');
  });
});

describe('diary workflow: bare session → enriched episodes', () => {
  test('diary episodes link to parent session via parent_id', () => {
    // Step 1: session-end hook writes bare episode
    const sessionId = insertBareEpisode(db, {
      kind: 'session',
      summary: 'Session: abc1234 feat: episodes (3 files)',
      body: '## Commits\n- abc1234 feat: episodes\n## Changed Files\n- episodes.ts',
      project: 'mindlore',
      source: 'hook',
    });

    // Step 2: diary mode extracts enriched episodes
    const decision = createEpisode(db, {
      kind: 'decision',
      summary: 'SQLite episodes tablosu > JSONL',
      body: '## Reason\nQuery gücü ve FTS5 entegrasyonu.',
      parent_id: sessionId,
      source: 'diary',
      project: 'mindlore',
    });

    const friction = createEpisode(db, {
      kind: 'friction',
      summary: 'PostToolUse hook stdout debug log\'a gidiyor',
      parent_id: sessionId,
      source: 'diary',
      project: 'mindlore',
    });

    // Verify parent linkage
    expect(decision.parent_id).toBe(sessionId);
    expect(friction.parent_id).toBe(sessionId);

    // Verify all episodes exist
    const all = queryEpisodes(db, { project: 'mindlore' });
    expect(all).toHaveLength(3); // session + decision + friction
  });

  test('diary episodes have source: diary', () => {
    const sessionId = insertBareEpisode(db, {
      kind: 'session',
      summary: 'Session',
      project: 'mindlore',
      source: 'hook',
    });

    createEpisode(db, {
      kind: 'learning',
      summary: 'ctx_execute_file kullan',
      parent_id: sessionId,
      source: 'diary',
      project: 'mindlore',
    });

    const diaryEps = queryEpisodes(db, { source: 'diary', project: 'mindlore' });
    expect(diaryEps).toHaveLength(1);
    expect(diaryEps[0]!.source).toBe('diary');
  });

  test('finding latest bare session for diary analysis', () => {
    // Simulate multiple sessions
    db.prepare(`INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at)
      VALUES ('ep-old', 'session', 'project', 'mindlore', 'Old session', 'active', 'hook', '2026-04-12T10:00:00.000Z')`).run();
    db.prepare(`INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at)
      VALUES ('ep-new', 'session', 'project', 'mindlore', 'Latest session', 'active', 'hook', '2026-04-13T15:00:00.000Z')`).run();

    // Query like diary would: find latest session episode
    const sessions = queryRecentEpisodes(db, { project: 'mindlore', limit: 1 });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.summary).toBe('Latest session');
  });
});

describe('deduplication rule', () => {
  test('each finding maps to exactly one kind — no duplicates', () => {
    const sessionId = insertBareEpisode(db, {
      kind: 'session',
      summary: 'Test session',
      project: 'mindlore',
      source: 'hook',
    });

    // Simulate diary extracting findings with priority rule:
    // decision > discovery > friction > learning > preference > event
    const findings: Array<{ kind: EpisodeKind; summary: string }> = [
      { kind: 'decision', summary: 'SQLite over JSONL' },
      { kind: 'discovery', summary: 'PostToolUse if doesnt work' },
      { kind: 'friction', summary: 'Hook stdout format confusion' },
      { kind: 'learning', summary: 'Use additionalContext JSON' },
    ];

    for (const f of findings) {
      createEpisode(db, {
        ...f,
        parent_id: sessionId,
        source: 'diary',
        project: 'mindlore',
      });
    }

    // Each finding has unique kind+summary — no duplicates
    const all = queryEpisodes(db, { source: 'diary', project: 'mindlore' });
    const summaries = all.map(e => e.summary);
    const uniqueSummaries = new Set(summaries);
    expect(summaries.length).toBe(uniqueSummaries.size);
  });
});

describe('reflect input: episodes query', () => {
  test('reflect can query active episodes from hook and diary sources', () => {
    insertBareEpisode(db, { kind: 'session', summary: 'S1', project: 'mindlore', source: 'hook' });
    createEpisode(db, { kind: 'friction', summary: 'F1', source: 'diary', project: 'mindlore' });
    createEpisode(db, { kind: 'learning', summary: 'L1', source: 'reflect', project: 'mindlore' });

    // Reflect should read hook + diary episodes (not its own output)
    const hookEps = queryEpisodes(db, { source: 'hook', project: 'mindlore' });
    const diaryEps = queryEpisodes(db, { source: 'diary', project: 'mindlore' });
    const reflectInput = [...hookEps, ...diaryEps];

    expect(reflectInput).toHaveLength(2);
    expect(reflectInput.some(e => e.source === 'reflect')).toBe(false);
  });

  test('reflect filters by date range', () => {
    db.prepare(`INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at)
      VALUES ('ep-old', 'friction', 'project', 'mindlore', 'Old friction', 'active', 'diary', '2026-04-01T10:00:00.000Z')`).run();
    db.prepare(`INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at)
      VALUES ('ep-recent', 'friction', 'project', 'mindlore', 'Recent friction', 'active', 'diary', '2026-04-13T10:00:00.000Z')`).run();

    const lastWeek = queryEpisodes(db, {
      project: 'mindlore',
      since: '2026-04-06T00:00:00.000Z',
    });
    expect(lastWeek).toHaveLength(1);
    expect(lastWeek[0]!.summary).toBe('Recent friction');
  });
});
