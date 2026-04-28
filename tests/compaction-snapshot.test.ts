import fs from 'fs';
import path from 'path';
import os from 'os';

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
