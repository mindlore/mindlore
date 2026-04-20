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

  test('createPreEvictionTag creates a git tag with slug and date', async () => {
    const { createPreEvictionTag } = await import('../scripts/lib/git-snapshot.js');
    const tag = createPreEvictionTag(mindloreDir, 'domains/ai-tools.md');
    expect(tag).toMatch(/^pre-evict\/ai-tools-\d{4}-\d{2}-\d{2}$/);
    const tags = execSync('git tag', { cwd: mindloreDir, encoding: 'utf8' });
    expect(tags).toContain('pre-evict/');
  });

  test('createPreEvictionTag resolves collision with suffix on duplicate tag', async () => {
    const { createPreEvictionTag } = await import('../scripts/lib/git-snapshot.js');
    const tag1 = createPreEvictionTag(mindloreDir, 'test.md');
    expect(tag1).toMatch(/^pre-evict\/test-\d{4}-\d{2}-\d{2}$/);
    const tag2 = createPreEvictionTag(mindloreDir, 'test.md');
    expect(tag2).toMatch(/^pre-evict\/test-\d{4}-\d{2}-\d{2}-2$/);
  });

  test('createPreEvictionTag accepts custom reason', async () => {
    const { createPreEvictionTag } = await import('../scripts/lib/git-snapshot.js');
    const tag = createPreEvictionTag(mindloreDir, 'test.md', 'manual-archive');
    expect(tag).toMatch(/^pre-evict\/test-\d{4}-\d{2}-\d{2}$/);
  });

  test('listPreEvictionTags returns empty array when no tags', async () => {
    const { listPreEvictionTags } = await import('../scripts/lib/git-snapshot.js');
    const tags = listPreEvictionTags(mindloreDir);
    expect(tags).toEqual([]);
  });

  test('listPreEvictionTags returns created tags', async () => {
    const { createPreEvictionTag, listPreEvictionTags } = await import('../scripts/lib/git-snapshot.js');
    createPreEvictionTag(mindloreDir, 'alpha.md');
    createPreEvictionTag(mindloreDir, 'beta.md');
    const tags = listPreEvictionTags(mindloreDir);
    expect(tags).toHaveLength(2);
    expect(tags.some((t: string) => t.includes('alpha'))).toBe(true);
    expect(tags.some((t: string) => t.includes('beta'))).toBe(true);
  });

  test('createPreEvictionTag returns null for non-git directory', async () => {
    const { createPreEvictionTag } = await import('../scripts/lib/git-snapshot.js');
    const nonGit = path.join(os.tmpdir(), `no-git-${Date.now()}`);
    fs.mkdirSync(nonGit, { recursive: true });
    try {
      const tag = createPreEvictionTag(nonGit, 'test.md');
      expect(tag).toBeNull();
    } finally {
      fs.rmSync(nonGit, { recursive: true, force: true });
    }
  });

  test('listPreEvictionTags returns empty for non-git directory', async () => {
    const { listPreEvictionTags } = await import('../scripts/lib/git-snapshot.js');
    const nonGit = path.join(os.tmpdir(), `no-git-${Date.now()}`);
    fs.mkdirSync(nonGit, { recursive: true });
    try {
      const tags = listPreEvictionTags(nonGit);
      expect(tags).toEqual([]);
    } finally {
      fs.rmSync(nonGit, { recursive: true, force: true });
    }
  });
});
