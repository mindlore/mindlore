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

export const CONFIG_FILE = 'config.json';

export const DEFAULT_MODELS: Record<string, string> = {
  ingest: 'haiku',
  evolve: 'sonnet',
  explore: 'sonnet',
  default: 'haiku',
} as const;

export const FTS5_COLUMNS = ['path', 'slug', 'description', 'type', 'category', 'title', 'content', 'tags', 'quality', 'date_captured'] as const;
export type FtsColumn = typeof FTS5_COLUMNS[number];

export const FRONTMATTER_TYPES = ['raw', 'source', 'domain', 'analysis', 'diary', 'decision', 'insight', 'connection', 'learning'] as const;
export type FrontmatterType = typeof FRONTMATTER_TYPES[number];

export const QUALITY_VALUES = ['high', 'medium', 'low'] as const;
export type QualityValue = typeof QUALITY_VALUES[number];

/**
 * Heuristic rules for auto-assigning quality based on source_type.
 * Used by quality-populate script and ingest skill.
 */
export const QUALITY_HEURISTICS: Record<string, QualityValue> = {
  'github-repo': 'high',
  'docs': 'high',
  'blog': 'medium',
  'video': 'medium',
  'x-thread': 'medium',
  'text-paste': 'low',
  'snippet': 'low',
  'forum': 'low',
};

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

/**
 * Check if markitdown (Python) is installed.
 * Memoized — spawns child process only once per session.
 */
let markitdownCached: boolean | null = null;
export function hasMarkitdown(): boolean {
  if (markitdownCached !== null) return markitdownCached;
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    execSync('markitdown --version', { stdio: 'pipe', timeout: 5000 });
    markitdownCached = true;
  } catch (_err) {
    markitdownCached = false;
  }
  return markitdownCached;
}

/**
 * Check if youtube-transcript npm package is available.
 * Optional fallback for YouTube transcript extraction when markitdown is absent.
 */
export function hasYoutubeTranscript(): boolean {
  try {
    require.resolve('youtube-transcript');
    return true;
  } catch (_err) {
    return false;
  }
}
