'use strict';

const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');

describe('Hook Smoke Tests', () => {
  const expectedHooks = [
    'mindlore-session-focus.cjs',
    'mindlore-search.cjs',
    'mindlore-index.cjs',
    'mindlore-fts5-sync.cjs',
    'mindlore-session-end.cjs',
    'mindlore-pre-compact.cjs',
    'mindlore-post-compact.cjs',
  ];

  test('all v0.1 hook files should exist', () => {
    for (const hook of expectedHooks) {
      const hookPath = path.join(HOOKS_DIR, hook);
      expect(fs.existsSync(hookPath)).toBe(true);
    }
  });

  test('all hooks should have valid syntax', () => {
    const vm = require('vm');

    for (const hook of expectedHooks) {
      const hookPath = path.join(HOOKS_DIR, hook);
      const content = fs.readFileSync(hookPath, 'utf8');

      // Compile without executing — catches syntax errors without running main()
      expect(() => {
        new vm.Script(content, { filename: hookPath });
      }).not.toThrow();
    }
  });

  test('all hooks should use strict mode', () => {
    for (const hook of expectedHooks) {
      const hookPath = path.join(HOOKS_DIR, hook);
      const content = fs.readFileSync(hookPath, 'utf8');
      expect(content).toContain("'use strict'");
    }
  });

  test('all hooks should have .cjs extension', () => {
    const hookFiles = fs
      .readdirSync(HOOKS_DIR)
      .filter((f) => f.startsWith('mindlore-'));

    for (const file of hookFiles) {
      expect(file).toMatch(/\.cjs$/);
    }
  });

  test('hook count should match v0.1 plan (7 hooks)', () => {
    const hookFiles = fs
      .readdirSync(HOOKS_DIR)
      .filter((f) => f.startsWith('mindlore-') && f.endsWith('.cjs'));

    expect(hookFiles).toHaveLength(7);
  });
});
