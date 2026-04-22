import type Database from 'better-sqlite3';

export interface CommonModuleBase {
  sha256: (content: string) => string;
  insertFtsRow: (
    db: Database.Database,
    entry: {
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
      project?: string | null;
    },
  ) => void;
  openDatabase: (dbPath: string) => Database.Database | null;
}

export interface CommonModuleWithFrontmatter extends CommonModuleBase {
  parseFrontmatter: (content: string) => { meta: Record<string, string>; body: string };
  extractFtsMetadata: (
    meta: Record<string, string>,
    body: string,
    filePath: string,
    baseDir: string,
  ) => {
    slug: string;
    description: string;
    type: string;
    category: string;
    title: string;
    tags: string;
    quality: string | null;
    dateCaptured: string | null;
  };
}

export const UPSERT_HASH_SQL = `
  INSERT INTO file_hashes (path, content_hash, last_indexed, source_type)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(path) DO UPDATE SET
    content_hash = excluded.content_hash,
    last_indexed = excluded.last_indexed,
    source_type = excluded.source_type
`;

export function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}
