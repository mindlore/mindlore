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
      // Health check exits non-zero when failures found — capture stdout from error
      output = (err as { stdout?: string }).stdout ?? '';
    }
    expect(output).toContain('type-dir mismatch');
  });
});
