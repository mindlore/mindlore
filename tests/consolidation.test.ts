import { createEpisodesTestEnv, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';
import { runMigrations, ensureSchemaTable } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V051_MIGRATIONS } from '../scripts/lib/migrations-v051.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';
import {
  countRawEpisodes,
  needsConsolidation,
  groupEpisodesByKind,
  markConsolidated,
} from '../scripts/lib/consolidation.js';

let env: EpisodesTestEnv;

beforeEach(() => {
  env = createEpisodesTestEnv('consolidation');
  ensureSchemaTable(env.db);
  runMigrations(env.db, [
    ...V050_MIGRATIONS,
    ...V051_MIGRATIONS,
    ...V052_MIGRATIONS,
    ...V053_MIGRATIONS,
  ]);
});

afterEach(() => {
  destroyEpisodesTestEnv(env);
});

function insertEpisode(db: ReturnType<typeof createEpisodesTestEnv>['db'], opts: {
  id: string;
  kind: string;
  summary: string;
  consolidation_status?: string;
  status?: string;
}): void {
  db.prepare(`
    INSERT INTO episodes (id, kind, scope, summary, status, created_at, consolidation_status)
    VALUES (?, ?, 'project', ?, ?, ?, ?)
  `).run(
    opts.id,
    opts.kind,
    opts.summary,
    opts.status ?? 'active',
    new Date().toISOString(),
    opts.consolidation_status ?? 'raw',
  );
}

describe('countRawEpisodes', () => {
  test('returns correct count of raw episodes', () => {
    insertEpisode(env.db, { id: 'ep-1', kind: 'session', summary: 'First' });
    insertEpisode(env.db, { id: 'ep-2', kind: 'decision', summary: 'Second' });
    insertEpisode(env.db, { id: 'ep-3', kind: 'session', summary: 'Third', consolidation_status: 'consolidated' });

    expect(countRawEpisodes(env.db)).toBe(2);
  });
});

describe('groupEpisodesByKind', () => {
  test('groups raw active episodes by kind', () => {
    insertEpisode(env.db, { id: 'ep-1', kind: 'session', summary: 'Session A' });
    insertEpisode(env.db, { id: 'ep-2', kind: 'session', summary: 'Session B' });
    insertEpisode(env.db, { id: 'ep-3', kind: 'decision', summary: 'Decision A' });
    insertEpisode(env.db, { id: 'ep-4', kind: 'session', summary: 'Consolidated', consolidation_status: 'consolidated' });
    insertEpisode(env.db, { id: 'ep-5', kind: 'insight', summary: 'Inactive', status: 'inactive' });

    const groups = groupEpisodesByKind(env.db);

    expect(groups.size).toBe(2);
    expect(groups.get('session')).toHaveLength(2);
    expect(groups.get('decision')).toHaveLength(1);
    expect(groups.has('insight')).toBe(false);
  });
});

describe('markConsolidated', () => {
  test('updates episode consolidation_status and consolidated_into', () => {
    insertEpisode(env.db, { id: 'ep-1', kind: 'session', summary: 'A' });
    insertEpisode(env.db, { id: 'ep-2', kind: 'session', summary: 'B' });

    markConsolidated(env.db, ['ep-1', 'ep-2'], 'consolidated/2026-04.md');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const ep1 = env.db.prepare('SELECT consolidation_status, consolidated_into FROM episodes WHERE id = ?').get('ep-1') as { consolidation_status: string; consolidated_into: string };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const ep2 = env.db.prepare('SELECT consolidation_status, consolidated_into FROM episodes WHERE id = ?').get('ep-2') as { consolidation_status: string; consolidated_into: string };

    expect(ep1.consolidation_status).toBe('consolidated');
    expect(ep1.consolidated_into).toBe('consolidated/2026-04.md');
    expect(ep2.consolidation_status).toBe('consolidated');
    expect(ep2.consolidated_into).toBe('consolidated/2026-04.md');
    expect(countRawEpisodes(env.db)).toBe(0);
  });
});

describe('needsConsolidation', () => {
  test('returns true when raw episode count meets threshold', () => {
    for (let i = 0; i < 51; i++) {
      insertEpisode(env.db, { id: `ep-${i}`, kind: 'session', summary: `Episode ${i}` });
    }

    expect(needsConsolidation(env.db, 50)).toBe(true);
    expect(needsConsolidation(env.db, 52)).toBe(false);
  });
});
