import { mergeDefaults } from '../scripts/lib/merge-defaults.js';

describe('mergeDefaults', () => {
  test('shallow merge — fills missing keys', () => {
    const { result, changed } = mergeDefaults({ a: 1 }, { a: 99, b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
    expect(changed).toBe(true);
  });

  test('deep merge — fills nested missing keys', () => {
    const { result, changed } = mergeDefaults(
      { x: { a: 1 } },
      { x: { a: 99, b: 2 } },
    );
    expect(result).toEqual({ x: { a: 1, b: 2 } });
    expect(changed).toBe(true);
  });

  test('does not overwrite existing values', () => {
    const { result, changed } = mergeDefaults({ a: 1, b: 2 }, { a: 99, b: 88 });
    expect(result).toEqual({ a: 1, b: 2 });
    expect(changed).toBe(false);
  });

  test('fills null/undefined with defaults', () => {
    const { result, changed } = mergeDefaults({ a: null, b: undefined } as Record<string, unknown>, { a: 1, b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
    expect(changed).toBe(true);
  });

  test('does not merge arrays — replaces', () => {
    const { result } = mergeDefaults({ a: [1, 2] }, { a: [3, 4] });
    expect(result).toEqual({ a: [1, 2] });
  });

  test('no changes returns changed=false', () => {
    const { result, changed } = mergeDefaults({ a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 1 });
    expect(changed).toBe(false);
  });
});
