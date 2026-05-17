import type { Migration } from './schema-version.js';
import { slugify } from './slugify.js';
import * as path from 'path';

export const V079_MIGRATIONS: Migration[] = [
  {
    version: 22,
    name: 'file_hashes_add_slug',
    up: (db) => {
      // 1. Add slug column
      db.exec(`ALTER TABLE file_hashes ADD COLUMN slug TEXT`);
      // 2. Backfill existing rows
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
      const rows = db.prepare(`SELECT rowid, path FROM file_hashes WHERE slug IS NULL`).all() as Array<{rowid: number, path: string}>;
      const update = db.prepare(`UPDATE file_hashes SET slug = ? WHERE rowid = ?`);
      const tx = db.transaction((batch: typeof rows) => {
        for (const row of batch) {
          const base = path.basename(row.path, '.md');
          update.run(slugify(base), row.rowid);
        }
      });
      tx(rows);
      // 3. Create index
      db.exec(`CREATE INDEX IF NOT EXISTS idx_file_hashes_slug ON file_hashes(slug)`);
    },
  },
];
