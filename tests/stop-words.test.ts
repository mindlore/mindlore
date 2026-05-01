import { STOP_WORDS, STOP_WORDS_MIN_LENGTH } from '../scripts/lib/constants';

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
