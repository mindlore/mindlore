import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Git Snapshot (Pre-Eviction)', () => {
  const tmpDir = path.join(os.tmpdir(), `mindlore-snapshot-${Date.now()}`);
  const mindloreDir = path.join(tmpDir, '.mindlore');

  beforeEach(() => {
    fs.mkdirSync(mindloreDir, { recursive: true });
    execSync('git init', { cwd: mindloreDir });
    execSync('git config user.email "test@test.com"', { cwd: mindloreDir });
    execSync('git config user.name "Test"', { cwd: mindloreDir });
    fs.writeFileSync(path.join(mindloreDir, 'test.md'), '# Test', 'utf8');
    execSync('git add . && git commit -m "init"', { cwd: mindloreDir });
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test('createPreEvictionTag creates a git tag with date prefix', async () => {
    const { createPreEvictionTag } = await import('../scripts/mindlore-backup.js');
    const tag = createPreEvictionTag(mindloreDir);
    expect(tag).toMatch(/^pre-eviction-\d{4}-\d{2}-\d{2}/);
    const tags = execSync('git tag', { cwd: mindloreDir, encoding: 'utf8' });
    expect(tags).toContain(tag);
  });

  test('createPreEvictionTag is idempotent (no error on same-day call)', async () => {
    const { createPreEvictionTag } = await import('../scripts/mindlore-backup.js');
    createPreEvictionTag(mindloreDir);
    const tag2 = createPreEvictionTag(mindloreDir);
    expect(tag2).toBeTruthy();
  });
});
