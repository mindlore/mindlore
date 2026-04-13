import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const MINDLORE_DIR: string;
export const GLOBAL_MINDLORE_DIR: string;
export const DB_NAME: string;
export const SKIP_FILES: Set<string>;
export const SQL_FTS_CREATE: string;
export const SQL_FTS_INSERT: string;
export const DEFAULT_MODELS: Record<string, string>;

export function globalDir(): string;
export function findMindloreDir(): string | null;
export function getActiveMindloreDir(): string | null;
export function getAllDbs(): string[];
export function getProjectName(): string;
export function getLatestDelta(diaryDir: string): string | null;
export function sha256(content: string): string;

export interface FrontmatterResult {
  meta: Record<string, unknown>;
  body: string;
}
export function parseFrontmatter(content: string): FrontmatterResult;

export interface FtsMetadata {
  slug: string;
  description: string;
  type: string;
  category: string;
  title: string;
  tags: string;
  quality: string | null;
  dateCaptured: string | null;
}
export function extractFtsMetadata(
  meta: Record<string, unknown>,
  body: string,
  filePath: string,
  baseDir: string,
): FtsMetadata;

export function readHookStdin(fields: string[]): string;

export interface FtsEntry {
  path: string;
  slug: string;
  description: string;
  type: string;
  category: string;
  title: string;
  content: string;
  tags: string;
  quality: string | null;
  dateCaptured: string | null;
  project: string;
}
export function insertFtsRow(db: Database, entry: FtsEntry): void;

export function extractHeadings(content: string, max?: number): string[];
export function requireDatabase(): typeof import('better-sqlite3');
export function openDatabase(dbPath: string, opts?: { readonly?: boolean }): Database | null;
export function getAllMdFiles(dir: string, skip?: Set<string>): string[];

export interface MindloreConfig {
  version?: string;
  created?: string;
  models?: Record<string, string>;
  [key: string]: unknown;
}
export function readConfig(mindloreDir: string): MindloreConfig | null;
export function detectSchemaVersion(db: unknown): number;
