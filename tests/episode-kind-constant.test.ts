describe('Episode kind shared constant', () => {
  test('CJS and TS share the same kinds array', () => {
    const { EPISODE_KINDS: cjsKinds } = require('../hooks/lib/constants.cjs');
    const { EPISODE_KINDS: tsKinds } = require('../scripts/lib/episodes.js');
    expect(cjsKinds).toEqual([...tsKinds]);
  });

  test('isValidKind validates correctly', () => {
    const { isValidKind } = require('../hooks/lib/constants.cjs');
    expect(isValidKind('nomination')).toBe(true);
    expect(isValidKind('invalid-kind')).toBe(false);
    expect(isValidKind('')).toBe(false);
  });
});

describe('DB_BUSY_TIMEOUT_MS shared constant', () => {
  test('CJS and TS export the same value', () => {
    const { DB_BUSY_TIMEOUT_MS: cjsTimeout } = require('../hooks/lib/constants.cjs');
    const { DB_BUSY_TIMEOUT_MS: tsTimeout } = require('../scripts/lib/constants.js');
    expect(cjsTimeout).toBe(tsTimeout);
  });

  test('value is a positive integer', () => {
    const { DB_BUSY_TIMEOUT_MS } = require('../hooks/lib/constants.cjs');
    expect(Number.isInteger(DB_BUSY_TIMEOUT_MS)).toBe(true);
    expect(DB_BUSY_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
