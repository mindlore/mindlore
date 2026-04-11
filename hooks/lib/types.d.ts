/**
 * Type declarations for mindlore-common.cjs hook functions.
 * Use with JSDoc @type imports in .cjs hook files.
 */

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

export interface FtsEntry {
  path: string;
  slug?: string;
  description?: string;
  type?: string;
  category?: string;
  title?: string;
  content?: string;
  tags?: string;
  quality?: string | null;
  dateCaptured?: string | null;
}

export interface ParsedFrontmatter {
  meta: Record<string, string | string[]>;
  body: string;
}

export interface MindloreCommon {
  MINDLORE_DIR: string;
  GLOBAL_MINDLORE_DIR: string;
  DB_NAME: string;
  SKIP_FILES: Set<string>;
  globalDir(): string;
  findMindloreDir(): string | null;
  getActiveMindloreDir(): string;
  getAllDbs(): string[];
  getLatestDelta(diaryDir: string): string | null;
  sha256(content: string): string;
  parseFrontmatter(content: string): ParsedFrontmatter;
  extractFtsMetadata(meta: Record<string, string>, body: string, filePath: string, baseDir: string): FtsMetadata;
  insertFtsRow(db: import('better-sqlite3').Database, entry: FtsEntry): void;
  readHookStdin(fields: string[]): string;
  extractHeadings(content: string, max: number): string[];
  requireDatabase(): typeof import('better-sqlite3') | null;
  openDatabase(dbPath: string, opts?: { readonly?: boolean }): import('better-sqlite3').Database | null;
  getAllMdFiles(dir: string, skip?: Set<string>): string[];
  SQL_FTS_CREATE: string;
  SQL_FTS_INSERT: string;
}
