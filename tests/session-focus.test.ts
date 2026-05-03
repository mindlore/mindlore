import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TEST_BASE = path.join(__dirname, '..', '.test-mindlore-session-focus');
let TEST_DIR: string;
const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'mindlore-session-focus.cjs');

function createMindloreDir(): string {
  const mindloreDir = path.join(TEST_DIR, '.mindlore');
  fs.mkdirSync(path.join(mindloreDir, 'diary'), { recursive: true });

  fs.writeFileSync(
    path.join(mindloreDir, 'INDEX.md'),
    '# Mindlore Index\n\n## Stats\n2 source, 1 analysis, 3 total\n'
  );

  return mindloreDir;
}

function createDelta(mindloreDir: string, name: string, content: string): void {
  fs.writeFileSync(
    path.join(mindloreDir, 'diary', name),
    content
  );
}

beforeEach(() => {
  // Unique dir per test — Windows EPERM on cleanup leaves stale files
  TEST_DIR = path.join(TEST_BASE, `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

afterAll(() => {
  try { fs.rmSync(TEST_BASE, { recursive: true, force: true }); } catch { /* best effort */ }
});

describe('Session Focus Hook', () => {
  test('should inject INDEX.md content when .mindlore/ exists', () => {
    createMindloreDir();

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).toContain('[Mindlore INDEX]');
    expect(output).toContain('2 source, 1 analysis, 3 total');
  });

  test('should inject latest delta when diary has entries', () => {
    const mindloreDir = createMindloreDir();

    createDelta(mindloreDir, 'delta-2026-04-09-1200.md', '# Old Delta\n\nOld session.');
    createDelta(mindloreDir, 'delta-2026-04-10-0900.md', '# Latest Delta\n\nLatest session.');

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).toContain('[Mindlore Delta: delta-2026-04-10-0900.md]');
    expect(output).toContain('Latest session');
    expect(output).not.toContain('Old session');
  });

  test('should produce no output when .mindlore/ does not exist', () => {
    const nonExistent = path.join(TEST_DIR, 'no-mindlore');
    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: nonExistent },
    });

    expect(output).toBe('');
  });

  test('should not inject reflect warning when diary entries below threshold', () => {
    const mindloreDir = createMindloreDir();

    // Create 4 deltas (below default threshold of 5)
    for (let i = 1; i <= 4; i++) {
      createDelta(mindloreDir, `delta-2026-04-0${i}-1200.md`, `# Delta ${i}\n`);
    }

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).not.toContain('diary entry birikti');
  });

  test('should inject reflect warning when diary entries reach threshold', () => {
    const mindloreDir = createMindloreDir();

    // Create 6 deltas (above default threshold of 5)
    for (let i = 1; i <= 6; i++) {
      createDelta(mindloreDir, `delta-2026-04-0${i}-1200.md`, `# Delta ${i}\n`);
    }

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).toContain('6 diary entry birikti');
    expect(output).toContain('/mindlore-log reflect');
  });

  test('should respect custom reflect threshold from config.json', () => {
    const mindloreDir = createMindloreDir();

    // Set custom threshold to 3
    fs.writeFileSync(
      path.join(mindloreDir, 'config.json'),
      JSON.stringify({ version: '0.3.3', reflect: { threshold: 3 } })
    );

    // Create 3 deltas (exactly at threshold)
    for (let i = 1; i <= 3; i++) {
      createDelta(mindloreDir, `delta-2026-04-0${i}-1200.md`, `# Delta ${i}\n`);
    }

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).toContain('3 diary entry birikti');
  });

  test('should not inject delta from a different project', () => {
    const mindloreDir = createMindloreDir();

    createDelta(mindloreDir, 'delta-2026-04-10-0900.md',
      '---\nslug: delta-2026-04-10-0900\ntype: diary\nproject: other-project\n---\n\n# Other Project Delta\n\nCommits from other project.');

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).not.toContain('[Mindlore Delta');
    expect(output).not.toContain('Other Project Delta');
  });

  test('should inject delta when project matches cwd basename', () => {
    const mindloreDir = createMindloreDir();
    const cwdBasename = path.basename(TEST_DIR);

    createDelta(mindloreDir, 'delta-2026-04-10-0900.md',
      `---\nslug: delta-2026-04-10-0900\ntype: diary\nproject: ${cwdBasename}\n---\n\n# Matching Delta\n\nSame project.`);

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    expect(output).toContain('[Mindlore Delta');
    expect(output).toContain('Matching Delta');
  });

  test('should handle missing diary directory gracefully', () => {
    const mindloreDir = path.join(TEST_DIR, '.mindlore');
    fs.mkdirSync(mindloreDir, { recursive: true });
    fs.writeFileSync(
      path.join(mindloreDir, 'INDEX.md'),
      '# Empty Index\n'
    );
    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: mindloreDir },
    });

    expect(output).toContain('[Mindlore INDEX]');
    expect(output).not.toContain('[Mindlore Delta');
  });
});

describe('corrupt DB recovery', () => {
  test('recovers from corrupt database', () => {
    const mindloreDir = createMindloreDir();
    const dbPath = path.join(mindloreDir, 'mindlore.db');
    fs.writeFileSync(dbPath, 'THIS IS NOT A SQLITE DATABASE');

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: mindloreDir },
    });

    expect(output).toContain('[Mindlore INDEX]');
    expect(fs.existsSync(dbPath + '.corrupt.bak')).toBe(true);
  });
});

describe('session-payload integration', () => {
  test('should still inject INDEX when session-payload module is available', () => {
    createMindloreDir();

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    // INDEX must always be present regardless of session-payload
    expect(output).toContain('[Mindlore INDEX]');
  });

  test('should not inject old-style Episodes or Hook Alerts sections', () => {
    createMindloreDir();

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, MINDLORE_HOME: path.join(TEST_DIR, '.mindlore') },
    });

    // Old scattered sections should no longer appear
    expect(output).not.toContain('[Mindlore Episodes]');
    expect(output).not.toContain('[Mindlore Recent Activity]');
    expect(output).not.toContain('[Mindlore Hook Alerts]');
  });

  test('should produce session-payload sections when DB has episode data', () => {
    const mindloreDir = createMindloreDir();

    // Create a DB with episodes for session-payload to find
    const { createEpisodesTestEnv, destroyEpisodesTestEnv } = require('./helpers/db.js');
    const { createEpisode } = require('../scripts/lib/episodes.js');
    const env = createEpisodesTestEnv('session-payload-hook');

    // Copy the test DB to the .mindlore dir so the hook finds it
    const dbSrcPath = path.join(env.tmpDir, 'test.db');
    const dbDestPath = path.join(mindloreDir, 'mindlore.db');

    // Insert test episodes
    createEpisode(env.db, {
      kind: 'decision',
      summary: 'Use session-payload module',
      project: path.basename(TEST_DIR),
      source: 'test',
    });
    createEpisode(env.db, {
      kind: 'friction',
      summary: 'Scattered injection was messy',
      project: path.basename(TEST_DIR),
      source: 'test',
    });

    env.db.close();
    fs.copyFileSync(dbSrcPath, dbDestPath);
    destroyEpisodesTestEnv(env);

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, MINDLORE_HOME: mindloreDir },
    });

    expect(output).toContain('[Mindlore INDEX]');
    // Session-payload sections use labels: Session, Decisions, Friction, Learnings
    expect(output).toContain('[Mindlore Session]');
  });
});

describe('enriched multi-session inject', () => {
  const { queryMultiSessionEpisodes, formatMultiSessionEpisodes } = require('../hooks/lib/mindlore-common.cjs');
  const { createEpisodesTestEnv, destroyEpisodesTestEnv } = require('./helpers/db.js');
  const { createEpisode } = require('../scripts/lib/episodes.js');

  let env: import('./helpers/db.js').EpisodesTestEnv;
  let db: import('better-sqlite3').Database;

  beforeEach(() => {
    env = createEpisodesTestEnv('multi-session');
    db = env.db;
  });

  afterEach(() => {
    destroyEpisodesTestEnv(env);
  });

  test('queryMultiSessionEpisodes returns enriched episodes', () => {
    createEpisode(db, {
      kind: 'decision',
      summary: 'Used FTS5 for search',
      project: 'test-project',
      source: 'diary',
    });
    createEpisode(db, {
      kind: 'learning',
      summary: 'CO-EVOLUTION pattern is critical',
      project: 'test-project',
      source: 'diary',
    });
    createEpisode(db, {
      kind: 'session',
      summary: 'Bare session',
      project: 'test-project',
      source: 'hook',
    });

    const results = queryMultiSessionEpisodes(db, { project: 'test-project', days: 3, limit: 20 });
    expect(results).toHaveLength(2);
    expect(results.every((r: { kind: string }) => r.kind !== 'session')).toBe(true);
  });

  test('excludes nomination kind from multi-session query', () => {
    createEpisode(db, {
      kind: 'nomination',
      summary: 'A nomination',
      project: 'test-project',
      source: 'reflect',
    });
    createEpisode(db, {
      kind: 'learning',
      summary: 'A learning',
      project: 'test-project',
      source: 'diary',
    });

    const results = queryMultiSessionEpisodes(db, { project: 'test-project', days: 3, limit: 20 });
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('learning');
  });

  test('formatMultiSessionEpisodes groups by date and kind', () => {
    const episodes = [
      { kind: 'decision', summary: 'Test decision', created_at: '2026-04-14T10:00:00Z' },
      { kind: 'learning', summary: 'Test learning', created_at: '2026-04-14T11:00:00Z' },
      { kind: 'friction', summary: 'Test friction', created_at: '2026-04-13T10:00:00Z' },
    ];

    const formatted = formatMultiSessionEpisodes(episodes);
    expect(formatted).toContain('[2026-04-14]');
    expect(formatted).toContain('decision:');
    expect(formatted).toContain('learning:');
    expect(formatted).toContain('[2026-04-13]');
    expect(formatted).toContain('friction:');
  });

  test('respects token cap by grouping when too many', () => {
    const episodes = [];
    for (let i = 0; i < 30; i++) {
      episodes.push({
        kind: 'learning',
        summary: `Learning item number ${i} with a reasonably long description`,
        created_at: '2026-04-14T10:00:00Z',
      });
    }

    const formatted = formatMultiSessionEpisodes(episodes);
    expect(formatted.length).toBeLessThan(2500);
  });

  test('returns empty string for no episodes', () => {
    expect(formatMultiSessionEpisodes([])).toBe('');
  });
});

describe('Q1/Q3 graduation inject', () => {
  function createDbWithSchema(mindloreDir: string): import('better-sqlite3').Database {
    const Database = require('better-sqlite3');
    const { ensureSchemaTable, runMigrations } = require('../dist/scripts/lib/schema-version.js');
    const { V050_MIGRATIONS } = require('../dist/scripts/lib/migrations.js');
    const { V051_MIGRATIONS } = require('../dist/scripts/lib/migrations-v051.js');
    const { V052_MIGRATIONS } = require('../dist/scripts/lib/migrations-v052.js');
    const { V053_MIGRATIONS } = require('../dist/scripts/lib/migrations-v053.js');
    const { V066_MIGRATIONS } = require('../dist/scripts/lib/migrations-v066.js');
    const { V067_MIGRATIONS } = require('../dist/scripts/lib/migrations-v067.js');
    const { ensureEpisodesTable } = require('../hooks/lib/mindlore-common.cjs');
    const dbPath = path.join(mindloreDir, 'mindlore.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE IF NOT EXISTS file_hashes (path TEXT PRIMARY KEY, hash TEXT, last_indexed TEXT)');
    db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(title, body, tags)');
    db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts_sessions USING fts5(title, body)');
    ensureEpisodesTable(db);
    ensureSchemaTable(db);
    runMigrations(db, [...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS, ...V053_MIGRATIONS]);
    for (let v = 9; v <= 13; v++) {
      db.prepare('INSERT OR IGNORE INTO schema_versions (version, name, applied_at) VALUES (?,?,?)').run(v, 'skip', new Date().toISOString());
    }
    runMigrations(db, [...V066_MIGRATIONS, ...V067_MIGRATIONS]);
    return db;
  }

  test('Q1 — injects reflect trigger when 5+ staged nominations exist', () => {
    const mindloreDir = createMindloreDir();
    const db = createDbWithSchema(mindloreDir);
    const project = path.basename(TEST_DIR);
    for (let i = 0; i < 6; i++) {
      db.prepare("INSERT INTO episodes (kind, scope, project, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        'nomination', 'global', project, `nom-${i}`, 'staged', new Date().toISOString()
      );
    }
    db.close();

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 10000,
      input: JSON.stringify({ session_id: 'test-q1' }),
      env: { ...process.env, MINDLORE_HOME: mindloreDir },
    });

    expect(output).toContain('6 bekleyen nomination');
    expect(output).toContain('/mindlore-reflect');
  });

  test('Q1 — no trigger when below threshold', () => {
    const mindloreDir = createMindloreDir();
    const db = createDbWithSchema(mindloreDir);
    const project = path.basename(TEST_DIR);
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO episodes (kind, scope, project, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        'nomination', 'global', project, `nom-${i}`, 'staged', new Date().toISOString()
      );
    }
    db.close();

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 10000,
      input: JSON.stringify({ session_id: 'test-q1-below' }),
      env: { ...process.env, MINDLORE_HOME: mindloreDir },
    });

    expect(output).not.toContain('bekleyen nomination');
  });

  test('Q3 — injects graduated lesson count when > 0', () => {
    const mindloreDir = createMindloreDir();
    const db = createDbWithSchema(mindloreDir);
    const project = path.basename(TEST_DIR);
    db.prepare("INSERT INTO episodes (kind, scope, project, summary, status, graduated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'nomination', 'global', project, 'grad-1', 'approved', new Date().toISOString(), new Date().toISOString()
    );
    db.prepare("INSERT INTO episodes (kind, scope, project, summary, status, graduated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      'nomination', 'global', project, 'grad-2', 'approved', new Date().toISOString(), new Date().toISOString()
    );
    db.close();

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 10000,
      input: JSON.stringify({ session_id: 'test-q3' }),
      env: { ...process.env, MINDLORE_HOME: mindloreDir },
    });

    expect(output).toContain('[Mindlore Graduation] 2 lesson mezun oldu');
  });

  test('Q3 — no message when no graduated lessons', () => {
    const mindloreDir = createMindloreDir();
    const db = createDbWithSchema(mindloreDir);
    db.close();

    const output = execSync(`node "${HOOK_PATH}"`, {
      cwd: TEST_DIR,
      encoding: 'utf8',
      timeout: 10000,
      input: JSON.stringify({ session_id: 'test-q3-zero' }),
      env: { ...process.env, MINDLORE_HOME: mindloreDir },
    });

    expect(output).not.toContain('lesson mezun oldu');
  });
});

describe('delta truncation', () => {
  it('should truncate changed files list when > 10', () => {
    const { truncateChangedFiles } = require('../hooks/mindlore-session-focus.cjs');
    const files = Array.from({ length: 15 }, (_, i) => `- file${i}.ts`).join('\n');
    const content = `## Changed Files\n${files}\n\n## Other`;
    const result = truncateChangedFiles(content);
    expect(result).toContain('file0.ts');
    expect(result).toContain('file9.ts');
    expect(result).not.toContain('file10.ts');
    expect(result).toContain('...ve 5 dosya daha');
  });

  it('should not truncate when <= 10 files', () => {
    const { truncateChangedFiles } = require('../hooks/mindlore-session-focus.cjs');
    const files = Array.from({ length: 5 }, (_, i) => `- file${i}.ts`).join('\n');
    const content = `## Changed Files\n${files}`;
    const result = truncateChangedFiles(content);
    expect(result).not.toContain('dosya daha');
  });
});
