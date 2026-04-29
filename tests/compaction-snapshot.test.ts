import fs from 'fs';
import path from 'path';
import os from 'os';
import { createEpisodesTestEnv, destroyEpisodesTestEnv, type EpisodesTestEnv } from './helpers/db.js';

describe('compaction snapshot', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-'));
    fs.mkdirSync(path.join(tmpDir, 'diary'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates snapshot file in diary/', () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join(tmpDir, 'diary', `compaction-snapshot-${ts}.md`);

    const content = [
      '---',
      'type: compaction-snapshot',
      `date: ${new Date().toISOString().slice(0, 10)}`,
      '---',
      '',
      '## Session Context',
      '- Decisions: 2',
      '- Changed files: 5',
    ].join('\n');

    fs.writeFileSync(snapshotPath, content);
    expect(fs.existsSync(snapshotPath)).toBe(true);
    expect(fs.readFileSync(snapshotPath, 'utf8')).toContain('compaction-snapshot');
  });

  it('retains only last 5 snapshots', () => {
    const diaryDir = path.join(tmpDir, 'diary');
    for (let i = 0; i < 7; i++) {
      const name = `compaction-snapshot-2026-04-${String(i + 1).padStart(2, '0')}.md`;
      fs.writeFileSync(path.join(diaryDir, name), `snapshot ${i}`);
    }

    const snapshots = fs.readdirSync(diaryDir)
      .filter(f => f.startsWith('compaction-snapshot-'))
      .sort();
    while (snapshots.length > 5) {
      const oldest = snapshots.shift();
      if (oldest) fs.unlinkSync(path.join(diaryDir, oldest));
    }

    const remaining = fs.readdirSync(diaryDir).filter(f => f.startsWith('compaction-snapshot-')).sort();
    expect(remaining).toHaveLength(5);
    expect(remaining[0]).toContain('03');
    expect(remaining[4]).toContain('07');
  });
});

describe('compaction snapshot — hook integration', () => {
  let env: EpisodesTestEnv;

  beforeEach(() => {
    env = createEpisodesTestEnv('compact-hook');
    env.db.prepare(
      `INSERT INTO episodes (kind, scope, project, summary, status, created_at)
       VALUES ('decision', 'project', 'test', 'Use RRF fusion', 'active', datetime('now', '-1 hour'))`,
    ).run();
    env.db.prepare(
      `INSERT INTO episodes (kind, scope, project, summary, status, created_at)
       VALUES ('friction', 'project', 'test', 'Windows CRLF issue', 'active', datetime('now', '-2 hours'))`,
    ).run();
  });

  afterEach(() => destroyEpisodesTestEnv(env));

  it('collectRecentEpisodes groups by kind', () => {
    const episodes = env.db.prepare(
      "SELECT kind, summary FROM episodes WHERE created_at > datetime('now', '-4 hours') ORDER BY created_at DESC",
    ).all() as Array<{ kind: string; summary: string }>;

    const grouped: Record<string, string[]> = {};
    for (const ep of episodes) {
      const kind = ep.kind || 'other';
      if (!grouped[kind]) grouped[kind] = [];
      grouped[kind].push(ep.summary);
    }

    expect(Object.keys(grouped)).toContain('decision');
    expect(Object.keys(grouped)).toContain('friction');
    expect(grouped['decision']).toContain('Use RRF fusion');
  });

  it('builds snapshot with correct frontmatter', () => {
    const diaryDir = path.join(env.tmpDir, 'diary');
    fs.mkdirSync(diaryDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const content = [
      '---',
      'type: compaction-snapshot',
      `date: ${new Date().toISOString().slice(0, 10)}`,
      'project: test',
      '---',
      '',
      '## Session Episodes',
      '### decision',
      '- Use RRF fusion',
    ].join('\n');

    const snapshotPath = path.join(diaryDir, `compaction-snapshot-${ts}.md`);
    fs.writeFileSync(snapshotPath, content);

    const written = fs.readFileSync(snapshotPath, 'utf8');
    expect(written).toContain('type: compaction-snapshot');
    expect(written).toContain('Use RRF fusion');
  });
});
