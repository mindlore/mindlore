import Database from 'better-sqlite3';
import { createEpisodesTestEnv, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';
import { createEpisode, supersede } from '../scripts/lib/episodes.js';

const {
  querySupersededChains,
  formatSupersededChains,
}: {
  querySupersededChains: (db: Database.Database, opts: { project: string; days?: number; limit?: number }) => Array<{ current: string; previous: string; reason: string | null }>;
  formatSupersededChains: (chains: Array<{ current: string; previous: string; reason: string | null }>) => string;
} = require('../hooks/lib/mindlore-common.cjs');

let env: EpisodesTestEnv;
let db: Database.Database;

beforeEach(() => {
  env = createEpisodesTestEnv('supersedes-chain');
  db = env.db;
});

afterEach(() => {
  destroyEpisodesTestEnv(env);
});

describe('supersedes chain query', () => {
  test('returns empty array when no superseded episodes', () => {
    const result = querySupersededChains(db, { project: 'test-project' });
    expect(result).toEqual([]);
  });

  test('returns chain when episode supersedes another', () => {
    const old = createEpisode(db, {
      kind: 'decision',
      summary: 'JSONL kullanacagiz',
      project: 'test-project',
      source: 'decide',
    });

    supersede(db, old.id, {
      kind: 'decision',
      summary: 'SQLite\'a gectik',
      body: '## Reason\nQuery gucu daha yuksek',
      project: 'test-project',
      source: 'decide',
    });

    const chains = querySupersededChains(db, { project: 'test-project' });
    expect(chains).toHaveLength(1);
    expect(chains[0]?.current).toBe('SQLite\'a gectik');
    expect(chains[0]?.previous).toBe('JSONL kullanacagiz');
    expect(chains[0]?.reason).toBe('Query gucu daha yuksek');
  });

  test('respects limit parameter', () => {
    for (let i = 0; i < 3; i++) {
      const old = createEpisode(db, {
        kind: 'decision',
        summary: `Old decision ${i}`,
        project: 'test-project',
        source: 'decide',
      });
      supersede(db, old.id, {
        kind: 'decision',
        summary: `New decision ${i}`,
        project: 'test-project',
        source: 'decide',
      });
    }

    const chains = querySupersededChains(db, { project: 'test-project', limit: 2 });
    expect(chains).toHaveLength(2);
  });

  test('filters by project', () => {
    const old = createEpisode(db, {
      kind: 'decision',
      summary: 'Other project decision',
      project: 'other-project',
      source: 'decide',
    });
    supersede(db, old.id, {
      kind: 'decision',
      summary: 'Other project new',
      project: 'other-project',
      source: 'decide',
    });

    const chains = querySupersededChains(db, { project: 'test-project' });
    expect(chains).toHaveLength(0);
  });

  test('parses reason from body ## Reason section', () => {
    const old = createEpisode(db, {
      kind: 'decision',
      summary: 'Old way',
      project: 'test-project',
      source: 'decide',
    });
    supersede(db, old.id, {
      kind: 'decision',
      summary: 'New way',
      body: '## Context\nSome context\n\n## Reason\nPerformance 3x better\n\n## Notes\nExtra info',
      project: 'test-project',
      source: 'decide',
    });

    const chains = querySupersededChains(db, { project: 'test-project' });
    expect(chains[0]?.reason).toBe('Performance 3x better');
  });
});

describe('supersedes chain format', () => {
  test('formats chain as "current <- previous (Reason: ...)"', () => {
    const chains = [
      { current: 'SQLite\'a gectik', previous: 'JSONL kullanacagiz', reason: 'Query gucu' },
      { current: 'FTS5 11-col', previous: '7-col', reason: null },
    ];

    const formatted = formatSupersededChains(chains);
    expect(formatted).toContain('SQLite\'a gectik');
    expect(formatted).toContain('JSONL kullanacagiz');
    expect(formatted).toContain('Reason: Query gucu');
    expect(formatted).toContain('FTS5 11-col');
    expect(formatted).toContain('7-col');
  });

  test('returns empty string for no chains', () => {
    expect(formatSupersededChains([])).toBe('');
  });
});
