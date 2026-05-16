import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { showLearning, listLearnings } from '../scripts/mindlore-learnings';

describe('mindlore-learnings', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mll-'));
    fs.mkdirSync(path.join(tmp, 'learnings'));
    fs.writeFileSync(path.join(tmp, 'learnings', 'dev-patterns-2026-04.md'), '# Dev Patterns\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7');
  });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns full content for existing slug', () => {
    const out = showLearning(tmp, 'dev-patterns-2026-04');
    expect(out).toContain('Line 7');
    expect(out).toContain('# Dev Patterns');
  });

  it('returns closest match for missing slug', () => {
    expect(() => showLearning(tmp, 'dev-patrn')).toThrow(/closest match.*dev-patterns-2026-04/);
  });

  it('lists all learnings with first line', () => {
    const list = listLearnings(tmp);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ slug: 'dev-patterns-2026-04', firstLine: '# Dev Patterns' });
  });
});
