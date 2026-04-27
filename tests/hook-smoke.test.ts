import fs from 'fs';
import path from 'path';
import vm from 'vm';

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

  describe('withTimeoutDb', () => {
    it('returns result within timeout', () => {
      const { withTimeoutDb, requireDatabase } = require('../hooks/lib/mindlore-common.cjs');
      const Database = requireDatabase();
      if (!Database) return; // skip if better-sqlite3 not available
      const db = new Database(':memory:');
      const result = withTimeoutDb(db, 'SELECT 1 as val', [], 3000);
      expect(result).toEqual([{ val: 1 }]);
      db.close();
    });

    it('returns empty array on null db', () => {
      const { withTimeoutDb } = require('../hooks/lib/mindlore-common.cjs');
      const result = withTimeoutDb(null, 'SELECT 1', [], 100);
      expect(result).toEqual([]);
    });

    it('returns empty array on invalid SQL', () => {
      const { withTimeoutDb, requireDatabase } = require('../hooks/lib/mindlore-common.cjs');
      const Database = requireDatabase();
      if (!Database) return;
      const db = new Database(':memory:');
      const result = withTimeoutDb(db, 'SELECT * FROM nonexistent_table', [], 100);
      expect(result).toEqual([]);
      db.close();
    });
  });

  test('hook count should match plan (14 hooks)', () => {
    const hookFiles = fs
      .readdirSync(HOOKS_DIR)
      .filter((f) => f.startsWith('mindlore-') && f.endsWith('.cjs'));

    expect(hookFiles).toHaveLength(14);
  });
});
