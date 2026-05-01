import { STOP_WORDS, STOP_WORDS_MIN_LENGTH } from '../scripts/lib/constants';
import path from 'path';

describe('STOP_WORDS', () => {
  it('contains core English stop words', () => {
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('and')).toBe(true);
  });

  it('contains Turkish stop words', () => {
    expect(STOP_WORDS.has('bir')).toBe(true);
    expect(STOP_WORDS.has('için')).toBe(true);
  });

  it('contains generic technical stop words', () => {
    expect(STOP_WORDS.has('hook')).toBe(true);
    expect(STOP_WORDS.has('config')).toBe(true);
  });

  it('exports minimum word length', () => {
    expect(STOP_WORDS_MIN_LENGTH).toBe(2);
  });
});

describe('STOP_WORDS fallback (S4)', () => {
  it('mindlore-common.cjs loads without dist/ by using inline fallback', () => {
    const commonPath = path.resolve(__dirname, '../hooks/lib/mindlore-common.cjs');
    const common = require(commonPath);
    expect(typeof common.extractKeywords).toBe('function');

    const keywords = common.extractKeywords('the TypeScript hooks are powerful');
    expect(keywords).toContain('typescript');
    expect(keywords).toContain('hooks');
    expect(keywords).toContain('powerful');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('are');
  });

  it('fallback STOP_WORDS set contains expected common words', () => {
    const commonPath = path.resolve(__dirname, '../hooks/lib/mindlore-common.cjs');
    const common = require(commonPath);

    const keywords = common.extractKeywords('a bu ve the is are TypeScript');
    expect(keywords).toContain('typescript');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('bu');
    expect(keywords).not.toContain('ve');
  });
});
