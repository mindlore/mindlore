import fs from 'fs';
import path from 'path';
import { extractSessionSummary, DECISION_KEYWORDS } from '../scripts/cc-session-sync.js';
import { createEpisodesTestEnv, destroyEpisodesTestEnv, type EpisodesTestEnv } from './helpers/db.js';

describe('session summary extraction', () => {
  it('extracts intent from first user message', () => {
    const transcript = [
      '---',
      'type: raw',
      'project: mindlore',
      '---',
      '',
      '## User',
      '',
      'v0.6.2 spec yaz',
      '',
      '## Assistant',
      '',
      'Tamam, başlıyorum.',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toContain('v0.6.2 spec yaz');
  });

  it('detects decision keywords', () => {
    const transcript = [
      '---',
      'type: raw',
      '---',
      '',
      '## User',
      '',
      'karar: tek DB kullan',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toContain('karar');
  });

  it('detects english decision keywords', () => {
    const transcript = [
      '---',
      'type: raw',
      '---',
      '',
      '## User',
      '',
      'decision: use single DB',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toContain('decision');
  });

  it('rejects bare words without decision context', () => {
    const text = 'implementasyon planı yazacağız';
    const hasDecision = DECISION_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
    expect(hasDecision).toBe(false);
  });

  it('includes last intent when different from first', () => {
    const transcript = [
      '---',
      'type: raw',
      '---',
      '',
      '## User',
      '',
      'brainstorming yap',
      '',
      '## Assistant',
      '',
      'Tamam.',
      '',
      '## User',
      '',
      'spec yaz',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toContain('brainstorming');
    expect(summary).toContain('spec yaz');
  });

  it('returns empty string for empty transcript', () => {
    const summary = extractSessionSummary('');
    expect(summary).toBe('');
  });

  it('handles transcript with no user messages', () => {
    const transcript = [
      '---',
      'type: raw',
      '---',
      '',
      '## Assistant',
      '',
      'Hello',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toBe('');
  });
});

describe('session summary → DB → payload integration', () => {
  let env: EpisodesTestEnv;

  beforeEach(() => {
    env = createEpisodesTestEnv('session-summary-int');
    // Run migrations to add session_summary column
    const { ensureSchemaTable, runMigrations } = require('../scripts/lib/schema-version.js') as {
      ensureSchemaTable: (db: import('better-sqlite3').Database) => void;
      runMigrations: (db: import('better-sqlite3').Database, m: unknown[]) => void;
    };
    const { V062_MIGRATIONS } = require('../scripts/lib/migrations-v062.js') as { V062_MIGRATIONS: unknown[] };
    ensureSchemaTable(env.db);
    runMigrations(env.db, V062_MIGRATIONS);
    fs.mkdirSync(path.join(env.tmpDir, 'diary'), { recursive: true });
  });

  afterEach(() => destroyEpisodesTestEnv(env));

  it('session-summary episode is readable by buildSessionPayload', () => {
    const { buildSessionPayload } = require('../scripts/lib/session-payload.js') as {
      buildSessionPayload: (db: import('better-sqlite3').Database, baseDir: string, project: string, budget?: number) => { sections: Array<{ label: string; content: string }> };
    };

    const summary = 'Intent: v0.6.3 search engine | Son: commit atıldı';
    env.db.prepare(
      `INSERT INTO episodes (kind, scope, project, summary, session_summary, status, created_at)
       VALUES ('session-summary', 'project', 'test-proj', ?, ?, 'active', datetime('now'))`,
    ).run(summary, summary);

    const payload = buildSessionPayload(env.db, env.tmpDir, 'test-proj', 5000);
    const pastSessions = payload.sections.find(s => s.label === 'Past Sessions');
    expect(pastSessions).toBeDefined();
    expect(pastSessions!.content).toContain('v0.6.3 search engine');
  });

  it('extractSessionSummary output fits in episode summary column', () => {
    const longTranscript = [
      '---', 'type: raw', '---', '',
      '## User', '', 'a'.repeat(200), '',
      '## Assistant', '', 'ok', '',
      '## User', '', 'b'.repeat(200), '',
    ].join('\n');

    const summary = extractSessionSummary(longTranscript);
    expect(summary.length).toBeLessThanOrEqual(500);
    expect(summary).toContain('Intent:');
  });
});
