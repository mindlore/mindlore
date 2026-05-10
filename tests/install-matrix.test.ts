import fs from 'fs';
import path from 'path';
import os from 'os';
import { cleanupLegacyHooks } from '../scripts/lib/settings-cleanup.js';

const FIXTURES = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-matrix-'));
  const src = path.join(FIXTURES, name);
  const dest = path.join(tmpDir, 'settings.json');
  fs.copyFileSync(src, dest);
  return dest;
}

function countMindloreHooks(settingsPath: string): number {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  let count = 0;
  for (const event of Object.keys(settings.hooks ?? {})) {
    for (const entry of settings.hooks[event] ?? []) {
      const hooks = entry.hooks ?? [entry];
      for (const h of hooks) {
        if (/node_modules[/\\]mindlore[/\\]hooks[/\\]/.test(h.command ?? '')) {
          count++;
        }
      }
    }
  }
  return count;
}

describe('Install Matrix — 4 scenarios', () => {
  describe('Scenario 1: Marketplace-only (clean settings.json)', () => {
    it('no legacy hooks in settings.json — cleanup is no-op', () => {
      const settingsPath = loadFixture('settings-clean.json');

      // Simulate: user only has plugin, never ran npx init
      const before = countMindloreHooks(settingsPath);
      expect(before).toBe(0);

      // Cleanup should do nothing
      const result = cleanupLegacyHooks(settingsPath);
      expect(result.removed).toBe(0);
    });
  });

  describe('Scenario 2: npx-only (hooks in settings.json, no plugin)', () => {
    it('legacy hooks present — cleanup removes them even without plugin', () => {
      const settingsPath = loadFixture('settings-with-mindlore-hooks.json');

      // Before: user ran old npx init, hooks are in settings.json
      const before = countMindloreHooks(settingsPath);
      expect(before).toBe(4);

      // New init runs → M2 cleanup triggers regardless of plugin status
      const result = cleanupLegacyHooks(settingsPath);
      expect(result.removed).toBe(4);

      // After: no legacy hooks — if user has no plugin, hooks won't fire
      // (expected: user should install plugin for hook support)
      const after = countMindloreHooks(settingsPath);
      expect(after).toBe(0);
    });
  });

  describe('Scenario 3: Both installed, user runs init (triggers M2)', () => {
    it('cleanup removes legacy hooks — single fire after', () => {
      const settingsPath = loadFixture('settings-with-mindlore-hooks.json');

      // Before: hooks in settings.json (from old npx init)
      const before = countMindloreHooks(settingsPath);
      expect(before).toBe(4);

      // User runs npx mindlore init → triggers idempotent cleanup
      const result = cleanupLegacyHooks(settingsPath);
      expect(result.removed).toBe(4);

      // After: no legacy hooks — plugin auto-discovery sole source
      const after = countMindloreHooks(settingsPath);
      expect(after).toBe(0);
    });
  });

  describe('Scenario 4: Upgrade path (npx mindlore upgrade)', () => {
    it('upgrade triggers same cleanup — idempotent', () => {
      const settingsPath = loadFixture('settings-with-mindlore-hooks.json');

      // First upgrade: removes legacy hooks
      const first = cleanupLegacyHooks(settingsPath);
      expect(first.removed).toBe(4);

      // Second upgrade: idempotent, nothing to remove
      const second = cleanupLegacyHooks(settingsPath);
      expect(second.removed).toBe(0);
    });
  });

  describe('Guard: user custom hooks preserved', () => {
    it('does not remove user hooks with mindlore- prefix but custom path', () => {
      const settingsPath = loadFixture('settings-mixed-hooks.json');

      const result = cleanupLegacyHooks(settingsPath);

      // Only node_modules-path hooks removed
      expect(result.removed).toBe(2);

      // User custom hook with mindlore- prefix but ~/.claude/hooks/ path survives
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const preToolUse = settings.hooks.PreToolUse;
      expect(preToolUse).toHaveLength(2); // bash-guard + user custom
      const commands = preToolUse.flatMap((e: Record<string, unknown>) =>
        ((e.hooks ?? [e]) as Array<{ command?: string }>).map((h) => h.command ?? ''),
      );
      expect(commands.some((c: string) => c.includes('mindlore-custom-hook'))).toBe(true);
    });
  });
});
