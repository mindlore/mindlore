import os from 'os';
import fs from 'fs';
import path from 'path';

export const MINDLORE_DIR = '.mindlore';
export const GLOBAL_MINDLORE_DIR = path.join(os.homedir(), MINDLORE_DIR);
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

/**
 * Resolve the active .mindlore/ directory.
 * If CWD has a .mindlore/ → project scope, otherwise → global (~/.mindlore/).
 */
export function getActiveMindloreDir(): string {
  const projectDir = path.join(process.cwd(), MINDLORE_DIR);
  if (fs.existsSync(projectDir)) {
    return projectDir;
  }
  return GLOBAL_MINDLORE_DIR;
}

/**
 * Return all mindlore DB paths (project + global), deduplicated.
 * Project DB first (higher priority in search), global second.
 */
export function getAllDbs(): string[] {
  const dbs: string[] = [];
  const projectDb = path.join(process.cwd(), MINDLORE_DIR, DB_NAME);
  const globalDb = path.join(GLOBAL_MINDLORE_DIR, DB_NAME);

  if (fs.existsSync(projectDb)) {
    dbs.push(projectDb);
  }
  if (fs.existsSync(globalDb) && globalDb !== projectDb) {
    dbs.push(globalDb);
  }
  return dbs;
}

/**
 * Shared log helper — indented console output for init/uninstall scripts.
 */
export function log(msg: string): void {
  console.log(`  ${msg}`);
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
