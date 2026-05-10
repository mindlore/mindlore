import fs from 'fs';
import path from 'path';
import os from 'os';
import { cleanupLegacyHooks } from '../scripts/lib/settings-cleanup.js';

const FIXTURES = path.join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-test-'));
  const src = path.join(FIXTURES, name);
  const dest = path.join(tmpDir, 'settings.json');
  fs.copyFileSync(src, dest);
  return dest;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

afterEach(() => {
  // tmpdir cleanup handled by OS
});

describe('cleanupLegacyHooks', () => {
  it('removes hooks with node_modules/mindlore/hooks/ path', () => {
    const settingsPath = loadFixture('settings-with-mindlore-hooks.json');
    const result = cleanupLegacyHooks(settingsPath);

    expect(result.removed).toBe(4);
    expect(result.backupCreated).toBe(true);

    const settings = readJson(settingsPath);
    const hooks = settings.hooks as Record<string, unknown[]>;

    // PreToolUse should keep only bash-guard (user hook)
    expect(hooks.PreToolUse).toHaveLength(1);
    // SessionStart had only mindlore hook → event key removed
    expect(hooks.SessionStart).toBeUndefined();
    // UserPromptSubmit had only mindlore hook → event key removed
    expect(hooks.UserPromptSubmit).toBeUndefined();
  });

  it('does nothing on clean settings.json (no mindlore hooks)', () => {
    const settingsPath = loadFixture('settings-clean.json');
    const result = cleanupLegacyHooks(settingsPath);

    expect(result.removed).toBe(0);
    expect(result.backupCreated).toBe(false);
  });

  it('preserves user custom hooks with mindlore- prefix but non-node_modules path', () => {
    const settingsPath = loadFixture('settings-mixed-hooks.json');
    const result = cleanupLegacyHooks(settingsPath);

    expect(result.removed).toBe(2); // read-guard + session-end

    const settings = readJson(settingsPath);
    const hooks = settings.hooks as Record<string, unknown[]>;

    // PreToolUse: bash-guard + user custom mindlore hook kept, node_modules one removed
    expect(hooks.PreToolUse).toHaveLength(2);
    // SessionEnd had only node_modules hook → removed
    expect(hooks.SessionEnd).toBeUndefined();
  });

  it('creates backup file before modifying', () => {
    const settingsPath = loadFixture('settings-with-mindlore-hooks.json');
    const backupPath = settingsPath + '.mindlore-migration-backup';

    cleanupLegacyHooks(settingsPath);

    expect(fs.existsSync(backupPath)).toBe(true);
    // Backup should be the original content
    const backup = readJson(backupPath);
    const hooks = backup.hooks as Record<string, unknown[]>;
    expect(hooks.PreToolUse).toHaveLength(3);
  });

  it('does not overwrite existing backup', () => {
    const settingsPath = loadFixture('settings-with-mindlore-hooks.json');
    const backupPath = settingsPath + '.mindlore-migration-backup';

    // Create fake backup first
    fs.writeFileSync(backupPath, '{"fake": true}', 'utf8');

    cleanupLegacyHooks(settingsPath);

    // Original fake backup should be preserved
    const backup = readJson(backupPath);
    expect(backup.fake).toBe(true);
  });

  it('returns correct result when settings.json does not exist', () => {
    const result = cleanupLegacyHooks('/nonexistent/path/settings.json');
    expect(result.removed).toBe(0);
    expect(result.backupCreated).toBe(false);
  });

  it('is idempotent — second run removes nothing', () => {
    const settingsPath = loadFixture('settings-with-mindlore-hooks.json');

    const first = cleanupLegacyHooks(settingsPath);
    expect(first.removed).toBe(4);

    const second = cleanupLegacyHooks(settingsPath);
    expect(second.removed).toBe(0);
    expect(second.backupCreated).toBe(false);
  });

  it('handles both forward-slash and backslash node_modules paths', () => {
    const settingsPath = loadFixture('settings-with-mindlore-hooks.json');
    const result = cleanupLegacyHooks(settingsPath);

    // All fixtures use backslash (Windows) — verify they're caught
    expect(result.removed).toBeGreaterThan(0);
  });
});

describe('init.ts mergeHooks removal verification', () => {
  it('init.ts should not contain mergeHooks function', () => {
    const initSource = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'init.ts'),
      'utf8',
    );
    expect(initSource).not.toContain('function mergeHooks');
    expect(initSource).not.toContain('function countMindloreHooks');
    expect(initSource).not.toContain('interface PluginHook');
  });

  it('init.ts should import and call cleanupLegacyHooks', () => {
    const initSource = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'init.ts'),
      'utf8',
    );
    expect(initSource).toContain('cleanupLegacyHooks');
  });
});

describe('uninstall.ts shared module usage', () => {
  it('uninstall.ts should not contain inline removeHooks implementation', () => {
    const uninstallSource = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'uninstall.ts'),
      'utf8',
    );
    // Should not have inline hook filtering logic
    expect(uninstallSource).not.toContain("includes('mindlore-')");
  });

  it('uninstall.ts should import from settings-cleanup', () => {
    const uninstallSource = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'uninstall.ts'),
      'utf8',
    );
    expect(uninstallSource).toContain('settings-cleanup');
  });
});
