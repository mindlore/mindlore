/**
 * session-payload tests — 4-section builder with token budget.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createEpisodesTestEnv, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';
import {
  buildSessionPayload,
} from '../scripts/lib/session-payload.js';

let env: EpisodesTestEnv;
let db: Database.Database;
let baseDir: string;

const PROJECT = 'test-project';

function insertEpisode(
  kind: string,
  summary: string,
  opts: { status?: string; project?: string; created_at?: string } = {},
): void {
  const id = `ep-${Math.random().toString(36).slice(2, 10)}`;
  db.prepare(
    `INSERT INTO episodes (id, kind, scope, project, summary, status, created_at)
     VALUES (?, ?, 'project', ?, ?, ?, ?)`,
  ).run(
    id,
    kind,
    opts.project ?? PROJECT,
    summary,
    opts.status ?? 'active',
    opts.created_at ?? new Date().toISOString(),
  );
}

function writeDelta(filename: string, content: string): void {
  const diaryDir = path.join(baseDir, 'diary');
  fs.mkdirSync(diaryDir, { recursive: true });
  fs.writeFileSync(path.join(diaryDir, filename), content, 'utf8');
}

beforeEach(() => {
  env = createEpisodesTestEnv('session-payload');
  db = env.db;
  baseDir = env.tmpDir;
});

afterEach(() => {
  destroyEpisodesTestEnv(env);
});

describe('buildSessionPayload', () => {
  test('produces 4 sections for a full DB', () => {
    writeDelta('delta-2026-04-19.md', '# Session\n- Did X\n- Did Y');
    insertEpisode('decision', 'Use TypeScript for all scripts');
    insertEpisode('friction', 'CI pipeline is slow');
    insertEpisode('learning', 'Always build before test');

    const payload = buildSessionPayload(db, baseDir, PROJECT);

    expect(payload.sections).toHaveLength(4);
    expect(payload.sections[0]!.label).toBe('Session');
    expect(payload.sections[1]!.label).toBe('Decisions');
    expect(payload.sections[2]!.label).toBe('Friction');
    expect(payload.sections[3]!.label).toBe('Learnings');
    expect(payload.totalTokens).toBeGreaterThan(0);
    expect(payload.contentHash).toMatch(/^[0-9a-f]{8}$/);
  });

  test('trims sections from end when over budget', () => {
    writeDelta('delta-2026-04-19.md', '# Session\n- Short');
    insertEpisode('decision', 'Short decision');
    insertEpisode('friction', 'Short friction');
    insertEpisode('learning', 'Short learning');

    const payload = buildSessionPayload(db, baseDir, PROJECT, 20);

    expect(payload.sections.length).toBeLessThan(4);
    expect(payload.sections[0]!.label).toBe('Session');
    expect(payload.totalTokens).toBeLessThanOrEqual(20);
  });

  test('trim order: Learnings dropped first, then Friction, then Decisions', () => {
    writeDelta('delta-2026-04-19.md', '# Session\n- Work');
    insertEpisode('decision', 'Dec');
    insertEpisode('friction', 'Fric');
    insertEpisode('learning', 'Learn');

    const full = buildSessionPayload(db, baseDir, PROJECT, 99999);
    const sessionTokens = full.sections[0]!.tokens;
    const decisionTokens = full.sections[1]!.tokens;

    const budgetFor2 = sessionTokens + decisionTokens + 1;
    const trimmed = buildSessionPayload(db, baseDir, PROJECT, budgetFor2);

    expect(trimmed.sections.map(s => s.label)).toEqual(['Session', 'Decisions']);
  });

  test('handles empty DB gracefully', () => {
    const payload = buildSessionPayload(db, baseDir, PROJECT);

    expect(payload.sections).toHaveLength(4);
    expect(payload.sections[0]!.content).toContain('No previous session data');
    expect(payload.sections[1]!.content).toContain('No recent decisions');
    expect(payload.sections[2]!.content).toContain('No active friction');
    expect(payload.sections[3]!.content).toContain('No recent learnings');
  });

  test('handles missing diary directory', () => {
    insertEpisode('decision', 'A decision');

    const payload = buildSessionPayload(db, baseDir, PROJECT);

    expect(payload.sections[0]!.label).toBe('Session');
    expect(payload.sections[0]!.content).toContain('No previous session data');
    expect(payload.sections).toHaveLength(4);
  });

  test('token estimation is reasonable', () => {
    const text = 'abcd'; // 4 chars = 1 token
    writeDelta('delta-2026-04-19.md', `# H\n- ${text}`);

    const payload = buildSessionPayload(db, baseDir, PROJECT);

    for (const section of payload.sections) {
      const expectedTokens = Math.ceil(section.content.length / 4);
      expect(section.tokens).toBe(expectedTokens);
    }
    const expectedTotal = payload.sections.reduce((s, sec) => s + sec.tokens, 0);
    expect(payload.totalTokens).toBe(expectedTotal);
  });

  test('reads latest delta file when multiple exist', () => {
    writeDelta('delta-2026-04-18.md', '# Old\n- Old stuff');
    writeDelta('delta-2026-04-19.md', '# Latest\n- Latest stuff');

    const payload = buildSessionPayload(db, baseDir, PROJECT);

    expect(payload.sections[0]!.content).toContain('Latest stuff');
    expect(payload.sections[0]!.content).not.toContain('Old stuff');
  });

  test('only returns episodes for matching project', () => {
    insertEpisode('decision', 'My project decision', { project: PROJECT });
    insertEpisode('decision', 'Other project decision', { project: 'other-project' });

    const payload = buildSessionPayload(db, baseDir, PROJECT);

    expect(payload.sections[1]!.content).toContain('My project decision');
    expect(payload.sections[1]!.content).not.toContain('Other project decision');
  });

  test('Session section is always kept even when over budget', () => {
    writeDelta('delta-2026-04-19.md', '# Session\n- Important context');
    insertEpisode('decision', 'Dec');
    insertEpisode('friction', 'Fric');
    insertEpisode('learning', 'Learn');

    const payload = buildSessionPayload(db, baseDir, PROJECT, 1);

    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0]!.label).toBe('Session');
  });
});
