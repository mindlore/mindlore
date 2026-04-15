import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

export function ensureSchemaTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

export function getSchemaVersion(db: Database): number {
  ensureSchemaTable(db);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
  const row = db.prepare('SELECT MAX(version) as v FROM schema_versions').get() as { v: number | null } | undefined;
  return row?.v ?? 0;
}

export function setSchemaVersion(db: Database, version: number, name?: string): void {
  ensureSchemaTable(db);
  db.prepare(
    'INSERT OR REPLACE INTO schema_versions (version, name, applied_at) VALUES (?, ?, ?)'
  ).run(version, name ?? `migration_${version}`, new Date().toISOString());
}

export function runMigrations(db: Database, migrations: Migration[]): void {
  ensureSchemaTable(db);
  const current = getSchemaVersion(db);

  const pending = migrations
    .filter(m => m.version > current)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    migration.up(db);
    setSchemaVersion(db, migration.version, migration.name);
  }
}
