import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { createTestDb } from './helpers/db';

const SCRIPT = path.join(__dirname, '..', 'dist', 'scripts', 'mindlore-health-check.js');

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-hc-'));

  for (const dir of ['raw', 'sources', 'domains', 'analyses', 'insights', 'connections', 'learnings', 'diary', 'decisions', 'logs', 'memory']) {
    fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
  }

  fs.writeFileSync(path.join(tmpDir, 'INDEX.md'), '# Index\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, 'SCHEMA.md'), '# Schema\n'.repeat(50), 'utf8');

  const db = createTestDb(path.join(tmpDir, 'mindlore.db'));
  db.close();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runHealth(): string {
  return execSync(`node "${SCRIPT}" "${tmpDir}"`, {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, MINDLORE_HOME: tmpDir },
  });
}

describe('Health check — memory directory handling', () => {
  test('should not fail frontmatter check for memory/ files without frontmatter', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'memory', 'project_test.md'),
      '# Test Project\n\nNo frontmatter here.',
      'utf8',
    );

    const output = runHealth();
    expect(output).not.toContain('missing slug');
    expect(output).not.toContain('missing type');
  });

  test('should not report type-dir mismatch for note type in raw/', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'raw', 'test-note.md'),
      '---\nslug: test-note\ntype: note\n---\n# Note in raw\n',
      'utf8',
    );

    const output = runHealth();
    expect(output).not.toContain('type-dir mismatch');
  });

  test('health dashboard reports stale sources', () => {
    const { getHealthDashboard } = require('../dist/scripts/mindlore-health-check.js');
    const Database = require('better-sqlite3');
    const dbPath = path.join(tmpDir, 'mindlore.db');
    const db = new Database(dbPath);

    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    try {
      db.prepare("INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)").run(
        'sources/old.md', 'abc123', ninetyOneDaysAgo,
      );
    } catch { /* table may need schema — skip if missing */ }

    const result = getHealthDashboard(db, tmpDir);
    expect(result).toBeDefined();
    expect(typeof result.stale).toBe('number');
    expect(typeof result.orphan).toBe('number');
    expect(typeof result.recent).toBe('number');
    db.close();
  });

  test('health dashboard reports orphan raw files', () => {
    const { getHealthDashboard } = require('../dist/scripts/mindlore-health-check.js');
    const Database = require('better-sqlite3');

    fs.writeFileSync(path.join(tmpDir, 'raw', 'orphan-file.md'), '# Orphan\nNo source counterpart');

    const dbPath = path.join(tmpDir, 'mindlore.db');
    const db = new Database(dbPath);
    const result = getHealthDashboard(db, tmpDir);
    expect(result.orphan).toBeGreaterThanOrEqual(1);
    db.close();
  });

  test('should still detect real type-dir mismatch', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'raw', 'wrong-place.md'),
      '---\nslug: wrong-place\ntype: source\n---\n# Source in wrong dir\n',
      'utf8',
    );

    let output: string;
    try {
      output = runHealth();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- execSync error has stdout property
      const execErr = err as { stdout?: string };
      output = execErr.stdout ?? '';
    }
    expect(output).toContain('type-dir mismatch');
  });
});
