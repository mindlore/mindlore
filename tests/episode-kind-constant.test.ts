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
