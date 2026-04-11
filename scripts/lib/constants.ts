import os from 'os';
import fs from 'fs';
import path from 'path';

export const MINDLORE_DIR = '.mindlore';
export const DB_NAME = 'mindlore.db';

export const DIRECTORIES = [
  'raw',
  'sources',
  'domains',
  'analyses',
  'insights',
  'connections',
  'learnings',
  'diary',
  'decisions',
] as const;

export const SKIP_FILES = new Set(['INDEX.md', 'SCHEMA.md', 'log.md']);

export const TYPE_TO_DIR: Record<string, string> = {
  raw: 'raw',
  source: 'sources',
  domain: 'domains',
  analysis: 'analyses',
  insight: 'insights',
  connection: 'connections',
  learning: 'learnings',
  decision: 'decisions',
  diary: 'diary',
};

export function homedir(): string {
  return os.homedir();
}

// ── Shared types (used by init.ts + uninstall.ts) ──────────────────────

export interface HookEntry {
  hooks?: Array<{ type?: string; command?: string }>;
  command?: string;
}

export interface Settings {
  hooks?: Record<string, HookEntry[]>;
  projectDocFiles?: string[];
  [key: string]: unknown;
}

/**
 * Filter predicate: true if file is NOT a skip file (INDEX.md, SCHEMA.md, log.md).
 */
export function isContentFile(filePath: string): boolean {
  return !SKIP_FILES.has(path.basename(filePath));
}

/**
 * Resolve hook common module path — works from both src/ and dist/.
 * From scripts/: ../hooks/lib/mindlore-common.cjs
 * From dist/scripts/: ../../hooks/lib/mindlore-common.cjs
 */
export function resolveHookCommon(callerDir: string): string {
  const candidate = path.resolve(callerDir, '..', 'hooks', 'lib', 'mindlore-common.cjs');
  if (fs.existsSync(candidate)) return candidate;
  return path.resolve(callerDir, '..', '..', 'hooks', 'lib', 'mindlore-common.cjs');
}
