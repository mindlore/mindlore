import os from 'os';
import fs from 'fs';
import path from 'path';

export const MINDLORE_DIR = '.mindlore';
export const GLOBAL_MINDLORE_DIR = process.env.MINDLORE_HOME ?? path.join(os.homedir(), MINDLORE_DIR);
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
  'logs',
] as const;

export const SKIP_FILES = new Set(['INDEX.md', 'SCHEMA.md', 'log.md']);

export const CONFIG_FILE = 'config.json';

export const DEFAULT_MODELS: Record<string, string> = {
  ingest: 'haiku',
  evolve: 'sonnet',
  explore: 'sonnet',
  default: 'haiku',
} as const;

export const VEC_TABLE_NAME = 'documents_vec';
export const SCHEMA_VERSION = 1;
export const EMBEDDING_MODEL_NAME = 'Xenova/multilingual-e5-small';
export const EMBEDDING_DIM_CONST = 384;

export const FTS5_COLUMNS = ['path', 'slug', 'description', 'type', 'category', 'title', 'content', 'tags', 'quality', 'date_captured', 'project'] as const;
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

/**
 * CC memory path pattern for FileChanged hook matching.
 * Matches: ~/.claude/projects/{name}/memory/{file}.md
 */
export const CC_MEMORY_PATH_MARKER = path.join('.claude', 'projects');
export const CC_MEMORY_DIR = 'memory';
export const CC_MEMORY_CATEGORY = 'cc-memory';
export const CC_MEMORY_BOOST = 1.2;

export function homedir(): string {
  return os.homedir();
}

/**
 * Always returns the global ~/.mindlore/ path.
 * v0.3.3: project scope removed — single global directory.
 */
export function getActiveMindloreDir(): string {
  return GLOBAL_MINDLORE_DIR;
}

/**
 * Return the single global mindlore DB path.
 * v0.3.3: multi-DB layered search removed — single global DB with project column.
 */
export function getAllDbs(): string[] {
  const dbPath = path.join(GLOBAL_MINDLORE_DIR, DB_NAME);
  if (fs.existsSync(dbPath)) return [dbPath];
  return [];
}

/**
 * Get current project name from CWD basename.
 * Used as the `project` column value in FTS5.
 */
export function getProjectName(): string {
  return path.basename(process.cwd());
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
  let dir = callerDir;
  for (let i = 0; i < 5; i++) {
    const target = path.join(dir, 'hooks', 'lib', 'mindlore-common.cjs');
    if (fs.existsSync(target)) return target;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
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
    const cp: typeof import('child_process') = require('child_process');
    const { execSync } = cp;
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

export const DEFAULT_TOKEN_BUDGET = {
  sessionInject: 2000,
  searchResults: 1500,
  perResult: 500,
} as const;

export const DECAY_HALF_LIFE_DAYS = 30;
export const STALE_THRESHOLD = 0.3;
export const CONSOLIDATION_THRESHOLD = 50;
