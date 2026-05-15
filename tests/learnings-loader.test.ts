import path from 'path';
import os from 'os';
import fs from 'fs';
const { loadLearningsBlock } = require('../hooks/lib/learnings-loader.cjs');

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'learnings-'));
  fs.mkdirSync(path.join(tmpDir, 'learnings'));
});

afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

function writeLesson(name: string, body: string, frontmatter = '') {
  const fm = frontmatter ? `---\n${frontmatter}\n---\n\n` : '';
  fs.writeFileSync(path.join(tmpDir, 'learnings', name), fm + body);
}

test('returns empty string when learnings dir is empty', () => {
  expect(loadLearningsBlock(tmpDir, 'any-project')).toBe('');
});

test('returns empty string when learnings dir missing', () => {
  fs.rmSync(path.join(tmpDir, 'learnings'), { recursive: true });
  expect(loadLearningsBlock(tmpDir, 'any-project')).toBe('');
});

test('injects top-N lessons with truncation hint', () => {
  for (let i = 0; i < 12; i++) {
    writeLesson(`lesson-${i}.md`, `## Topic ${i}\n- rule line 1\n- rule line 2`, 'project: global');
  }
  const block = loadLearningsBlock(tmpDir, 'mindlore');
  expect(block).toContain('[Mindlore Learnings]');
  const headings = (block.match(/^## /gm) ?? []).length;
  expect(headings).toBeLessThanOrEqual(10);
});

test('respects per-lesson 5-line cap and adds full-path hint', () => {
  const long = Array.from({ length: 20 }, (_, i) => `- rule ${i}`).join('\n');
  writeLesson('big.md', `## Big Topic\n${long}`, 'project: global');
  const block = loadLearningsBlock(tmpDir, 'mindlore');
  expect(block).toContain('… (full: .mindlore/learnings/big.md)');
});

test('scope filter: includes global and current project, excludes others', () => {
  writeLesson('a.md', '## A\n- rule', 'project: global');
  writeLesson('b.md', '## B\n- rule', 'project: mindlore');
  writeLesson('c.md', '## C\n- rule', 'project: kastell');
  const block = loadLearningsBlock(tmpDir, 'mindlore');
  expect(block).toContain('## A');
  expect(block).toContain('## B');
  expect(block).not.toContain('## C');
});

test('missing project frontmatter is treated as global', () => {
  writeLesson('legacy.md', '## Legacy\n- rule', '');
  const block = loadLearningsBlock(tmpDir, 'mindlore');
  expect(block).toContain('## Legacy');
});

test('total char cap reduces N when exceeded', () => {
  const huge = '## Big\n' + 'x'.repeat(2000);
  for (let i = 0; i < 10; i++) {
    writeLesson(`l${i}.md`, huge, 'project: global');
  }
  const block = loadLearningsBlock(tmpDir, 'mindlore');
  expect(block.length).toBeLessThanOrEqual(6500);
});
