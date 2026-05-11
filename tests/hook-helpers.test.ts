import { unwrapHookEntries, isMindloreHook, countMindloreHooks } from '../scripts/lib/hook-helpers.js';

describe('hook-helpers', () => {
  describe('unwrapHookEntries', () => {
    it('returns array from nested hooks', () => {
      const entry = { hooks: [{ command: 'a' }, { command: 'b' }] };
      expect(unwrapHookEntries(entry)).toEqual([{ command: 'a' }, { command: 'b' }]);
    });

    it('wraps single entry in array', () => {
      const entry = { command: 'solo' };
      expect(unwrapHookEntries(entry)).toEqual([{ command: 'solo' }]);
    });
  });

  describe('isMindloreHook', () => {
    it('detects mindlore hook in nested', () => {
      expect(isMindloreHook({ hooks: [{ command: 'node mindlore-search.cjs' }] })).toBe(true);
    });

    it('returns false for non-mindlore', () => {
      expect(isMindloreHook({ command: 'node other-hook.cjs' })).toBe(false);
    });
  });

  describe('countMindloreHooks', () => {
    it('counts across events', () => {
      const hooks = {
        UserPromptSubmit: [
          { hooks: [{ command: 'node mindlore-search.cjs' }, { command: 'node mindlore-decision.cjs' }] },
        ],
        SessionStart: [{ command: 'node mindlore-session-focus.cjs' }],
      };
      expect(countMindloreHooks(hooks)).toBe(3);
    });

    it('returns 0 for empty', () => {
      expect(countMindloreHooks({})).toBe(0);
    });

    it('skips non-object entries gracefully', () => {
      const hooks = {
        SessionStart: [null, undefined, 42, 'string', { command: 'node mindlore-search.cjs' }] as unknown[],
      };
      expect(countMindloreHooks(hooks)).toBe(1);
    });
  });
});
