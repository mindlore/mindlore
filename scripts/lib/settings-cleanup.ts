import fs from 'fs';
import type { Settings } from './constants.js';
import { parseJsonObject } from './safe-parse.js';

export interface CleanupResult {
  removed: number;
  backupCreated: boolean;
}

interface HookEntry {
  hooks?: Array<{ command?: string }>;
  command?: string;
  [key: string]: unknown;
}

const NODE_MODULES_PATTERN = /node_modules[/\\]mindlore[/\\]hooks[/\\]/;

function isLegacyMindloreHook(entry: HookEntry): boolean {
  const hooks = entry.hooks && Array.isArray(entry.hooks) ? entry.hooks : [entry];
  return hooks.some((h) => NODE_MODULES_PATTERN.test(h.command ?? ''));
}

export function cleanupLegacyHooks(settingsPath: string): CleanupResult {
  if (!fs.existsSync(settingsPath)) {
    return { removed: 0, backupCreated: false };
  }

  let settings: Settings;
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    settings = parseJsonObject<Settings>(raw);
  } catch {
    return { removed: 0, backupCreated: false };
  }

  if (!settings.hooks) {
    return { removed: 0, backupCreated: false };
  }

  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!Array.isArray(entries)) continue;

    const filtered = entries.filter((entry) => {
      if (isLegacyMindloreHook(entry as HookEntry)) {
        removed++;
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      delete settings.hooks[event];
    } else {
      settings.hooks[event] = filtered;
    }
  }

  if (removed === 0) {
    return { removed: 0, backupCreated: false };
  }

  // Backup — don't overwrite existing
  const backupPath = settingsPath + '.mindlore-migration-backup';
  let backupCreated = false;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(settingsPath, backupPath);
    backupCreated = true;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

  return { removed, backupCreated };
}
