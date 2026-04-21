import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { createTestDb } from './helpers/db';

// Import functions under test
let convertJsonlToMd: typeof import('../scripts/cc-session-sync').convertJsonlToMd;
let discoverSessionFiles: typeof import('../scripts/cc-session-sync').discoverSessionFiles;
let syncSessions: typeof import('../scripts/cc-session-sync').syncSessions;

// Dynamically import after build
beforeAll(() => {
  const mod = require('../dist/scripts/cc-session-sync.js');
  convertJsonlToMd = mod.convertJsonlToMd;
  discoverSessionFiles = mod.discoverSessionFiles;
  syncSessions = mod.syncSessions;
});

// ── Helpers ───────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-session-sync-'));
}

function writeJsonl(dir: string, filename: string, lines: object[]): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, lines.map(l => JSON.stringify(l)).join('\n'), 'utf8');
  return filePath;
}

function createSampleJsonl(dir: string, sessionId: string, projectName: string): string {
  const projDir = path.join(dir, 'projects', projectName);
  fs.mkdirSync(projDir, { recursive: true });

  const lines = [
    { type: 'permission-mode', permissionMode: 'default', sessionId, timestamp: '2026-04-20T10:00:00Z' },
    { type: 'system', content: 'system prompt', timestamp: '2026-04-20T10:00:01Z', gitBranch: 'main', cwd: '/test' },
    { type: 'user', message: { role: 'user', content: 'transaction wrap hakkında ne düşünüyorsun?' }, timestamp: '2026-04-20T10:01:00Z' },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Transaction wrap atomiklik sağlar.' }, { type: 'tool_use', name: 'Read', input: { file_path: '/test.ts' } }] } },
    { type: 'attachment', attachment: { type: 'system-reminder' } },
    { type: 'user', message: { role: 'user', content: 'peki secret: sk-ant-test1234567890123456 ve AKIA1234567890ABCDEF' }, timestamp: '2026-04-20T10:02:00Z' },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Bunu kaydetmemeliyiz.' }] } },
  ];

  return writeJsonl(projDir, `${sessionId}.jsonl`, lines);
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('cc-session-sync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('convertJsonlToMd', () => {
    it('should extract user and assistant text messages', () => {
      createSampleJsonl(tmpDir, 'test-session-1', 'C--test-project');
      const realPath = path.join(tmpDir, 'projects', 'C--test-project', 'test-session-1.jsonl');
      const { md, userCount, assistantCount } = convertJsonlToMd(realPath, 'C--test-project');

      expect(userCount).toBe(2);
      expect(assistantCount).toBe(2);
      expect(md).toContain('transaction wrap hakkında');
      expect(md).toContain('Transaction wrap atomiklik sağlar.');
      expect(md).toContain('Bunu kaydetmemeliyiz.');
    });

    it('should not include tool_use or attachment content', () => {
      createSampleJsonl(tmpDir, 'test-session-2', 'C--test-project');
      const realPath = path.join(tmpDir, 'projects', 'C--test-project', 'test-session-2.jsonl');
      const { md } = convertJsonlToMd(realPath, 'C--test-project');

      expect(md).not.toContain('tool_use');
      expect(md).not.toContain('Read');
      expect(md).not.toContain('system-reminder');
    });

    it('should scrub secrets from content', () => {
      createSampleJsonl(tmpDir, 'test-session-3', 'C--test-project');
      const realPath = path.join(tmpDir, 'projects', 'C--test-project', 'test-session-3.jsonl');
      const { md } = convertJsonlToMd(realPath, 'C--test-project');

      expect(md).not.toContain('sk-ant-test1234567890123456');
      expect(md).not.toContain('AKIA1234567890ABCDEF');
      expect(md).toContain('[REDACTED]');
    });

    it('should generate correct frontmatter', () => {
      createSampleJsonl(tmpDir, 'test-session-4', 'C--test-project');
      const realPath = path.join(tmpDir, 'projects', 'C--test-project', 'test-session-4.jsonl');
      const { md } = convertJsonlToMd(realPath, 'C--test-project');

      expect(md).toContain('type: raw');
      expect(md).toContain('project: C--test-project');
      expect(md).toContain('category: cc-session');
      expect(md).toContain('date: 2026-04-20');
      expect(md).toContain('branch: main');
      expect(md).toContain('messages: 2 user, 2 assistant');
    });

    it('should return date from frontmatter', () => {
      createSampleJsonl(tmpDir, 'test-session-date', 'C--Users-Test-Documents-myapp');
      const realPath = path.join(tmpDir, 'projects', 'C--Users-Test-Documents-myapp', 'test-session-date.jsonl');
      const { date } = convertJsonlToMd(realPath, 'C--Users-Test-Documents-myapp');
      expect(date).toBe('2026-04-20');
    });

    it('should extract correct project slug from hyphenated names', () => {
      createSampleJsonl(tmpDir, 'test-slug', 'C--Users-Omrfc-Desktop-la-roma-stock');
      const realPath = path.join(tmpDir, 'projects', 'C--Users-Omrfc-Desktop-la-roma-stock', 'test-slug.jsonl');
      const { md } = convertJsonlToMd(realPath, 'C--Users-Omrfc-Desktop-la-roma-stock');
      expect(md).toContain('project: la-roma-stock');
    });

    it('should return zero counts for empty session', () => {
      const projDir = path.join(tmpDir, 'projects', 'C--empty');
      fs.mkdirSync(projDir, { recursive: true });
      const jsonlPath = writeJsonl(projDir, 'empty.jsonl', [
        { type: 'permission-mode', permissionMode: 'default', timestamp: '2026-04-20T10:00:00Z' },
      ]);

      const { userCount, assistantCount } = convertJsonlToMd(jsonlPath, 'C--empty');
      expect(userCount).toBe(0);
      expect(assistantCount).toBe(0);
    });
  });

  describe('scrubSecrets', () => {
    it('should redact all known secret patterns', () => {
      const projDir = path.join(tmpDir, 'projects', 'C--secrets');
      fs.mkdirSync(projDir, { recursive: true });

      const lines = [
        { type: 'user', message: { role: 'user', content: [
          'sk-ant-abc12345678901234567890',
          'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
          'AKIA1234567890ABCDEF',
          'xoxb-token-here-12345678901234',
          'AIzaSyA12345678901234567890123456789ab',
          'sk_live_abcdefghijklmnopqrstuv',
          '-----BEGIN RSA PRIVATE KEY-----',
          'postgres://user:secret_pass@localhost:5432/db',
        ].join('\n') }, timestamp: '2026-04-20T10:00:00Z' },
      ];

      const jsonlPath = writeJsonl(projDir, 'secrets.jsonl', lines);
      const { md } = convertJsonlToMd(jsonlPath, 'C--secrets');

      expect(md).not.toContain('sk-ant-abc');
      expect(md).not.toContain('ghp_abcdef');
      expect(md).not.toContain('AKIA1234');
      expect(md).not.toContain('xoxb-token');
      expect(md).not.toContain('AIzaSy');
      expect(md).not.toContain('sk_live_');
      expect(md).not.toContain('PRIVATE KEY');
      expect(md).not.toContain('secret_pass');
    });
  });

  describe('discoverSessionFiles', () => {
    it('should find JSONL files in project directories', () => {
      const claudeDir = path.join(tmpDir, '.claude');
      createSampleJsonl(claudeDir, 'session-a', 'C--project-one');
      createSampleJsonl(claudeDir, 'session-b', 'C--project-two');

      const files = discoverSessionFiles(claudeDir);
      expect(files).toHaveLength(2);
      expect(files.map(f => f.sessionId).sort()).toEqual(['session-a', 'session-b']);
      expect(files.map(f => f.projectName).sort()).toEqual(['C--project-one', 'C--project-two']);
    });

    it('should return empty for non-existent claude dir', () => {
      const files = discoverSessionFiles(path.join(tmpDir, 'nonexistent'));
      expect(files).toHaveLength(0);
    });
  });

  describe('syncSessions', () => {
    it('should write MD files and index in FTS5', () => {
      const claudeDir = path.join(tmpDir, '.claude');
      createSampleJsonl(claudeDir, 'sync-test-1', 'C--sync-project');

      const mindloreDir = path.join(tmpDir, '.mindlore');
      fs.mkdirSync(mindloreDir, { recursive: true });

      const dbPath = path.join(mindloreDir, 'mindlore.db');
      const db = createTestDb(dbPath);
      db.close();

      // Make file old enough to not be skipped
      const jsonlPath = path.join(claudeDir, 'projects', 'C--sync-project', 'sync-test-1.jsonl');
      const oldTime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(jsonlPath, oldTime, oldTime);

      const sessions = discoverSessionFiles(claudeDir);
      const result = syncSessions(dbPath, sessions, mindloreDir);

      expect(result.synced).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify MD file exists
      const sessionsDir = path.join(mindloreDir, 'raw', 'sessions', 'C--sync-project');
      expect(fs.existsSync(sessionsDir)).toBe(true);
      const mdFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.md'));
      expect(mdFiles).toHaveLength(1);
      expect(mdFiles[0]).toMatch(/^2026-04-20-sync-tes\.md$/);

      // Verify FTS5 entry
      const verifyDb = new Database(dbPath);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test assertion on DB row
      const ftsRow = verifyDb.prepare("SELECT * FROM mindlore_fts WHERE category = 'cc-session'").get() as Record<string, string>;
      expect(ftsRow).toBeDefined();
      expect(ftsRow.project).toBe('C--sync-project');
      expect(ftsRow.type).toBe('raw');
      verifyDb.close();
    });

    it('should skip active sessions (< 2 min old)', () => {
      const claudeDir = path.join(tmpDir, '.claude');
      createSampleJsonl(claudeDir, 'active-session', 'C--active');

      const mindloreDir = path.join(tmpDir, '.mindlore');
      fs.mkdirSync(mindloreDir, { recursive: true });
      const dbPath = path.join(mindloreDir, 'mindlore.db');
      const db = createTestDb(dbPath);
      db.close();

      // Don't modify mtime — file is fresh (just created)
      const sessions = discoverSessionFiles(claudeDir);
      const result = syncSessions(dbPath, sessions, mindloreDir);

      expect(result.skipped).toBe(1);
      expect(result.synced).toBe(0);
    });

    it('should be idempotent — second run skips already synced', () => {
      const claudeDir = path.join(tmpDir, '.claude');
      createSampleJsonl(claudeDir, 'idem-test', 'C--idem');

      const mindloreDir = path.join(tmpDir, '.mindlore');
      fs.mkdirSync(mindloreDir, { recursive: true });
      const dbPath = path.join(mindloreDir, 'mindlore.db');
      const db = createTestDb(dbPath);
      db.close();

      const jsonlPath = path.join(claudeDir, 'projects', 'C--idem', 'idem-test.jsonl');
      const oldTime = new Date(Date.now() - 20 * 60 * 1000);
      fs.utimesSync(jsonlPath, oldTime, oldTime);

      const sessions = discoverSessionFiles(claudeDir);

      const run1 = syncSessions(dbPath, sessions, mindloreDir);
      expect(run1.synced).toBe(1);

      const run2 = syncSessions(dbPath, sessions, mindloreDir);
      expect(run2.skipped).toBeGreaterThanOrEqual(1);
      expect(run2.synced).toBe(0);
    });
  });
});
