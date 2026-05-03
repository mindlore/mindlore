/**
 * Type-safe wrappers for better-sqlite3 queries.
 * Centralizes the single unavoidable `as T` cast — better-sqlite3's
 * .get() and .all() return `unknown` by design.
 */
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

import Database_ctor from 'better-sqlite3';
import fs from 'fs';
import { DB_BUSY_TIMEOUT_MS } from './constants.js';

/**
 * Typed wrapper for Statement.get().
 * Returns undefined if no row matches.
 */
export function dbGet<T extends object>(
  db: Database,
  sql: string,
  ...params: unknown[]
): T | undefined {
  const result = db.prepare(sql).get(...params);
  if (result === undefined) return undefined;
  if (typeof result !== 'object' || result === null) {
    throw new TypeError(`Expected object from query, got ${typeof result}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- centralized cast: runtime-validated object
  return result as T;
}

/**
 * Typed wrapper for Statement.all().
 */
export function dbAll<T extends object>(
  db: Database,
  sql: string,
  ...params: unknown[]
): T[] {
  const results = db.prepare(sql).all(...params);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- centralized cast: better-sqlite3 always returns object[]
  return results as T[];
}

/**
 * Typed wrapper for Database.pragma().
 */
export function dbPragma<T>(db: Database, pragma: string): T[] {
  const result = db.pragma(pragma);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- centralized cast: pragma returns array of objects
  return result as T[];
}


/**
 * Open a readonly DB, run fn, close DB. Returns undefined on error.
 */
export function withReadonlyDb<T>(
  dbPath: string,
  fn: (db: Database) => T
): T | undefined {
  let db: Database | null = null;
  try {
    db = new Database_ctor(dbPath, { readonly: true });
    return fn(db);
  } catch {
    return undefined;
  } finally {
    db?.close();
  }
}

/**
 * Open a database with existence check. Returns null if file missing or error.
 */
export function openDatabaseTs(
  dbPath: string,
  options?: { readonly?: boolean }
): Database | null {
  try {
    if (!fs.existsSync(dbPath)) return null;
    const readonly = options?.readonly ?? false;
    const db = new Database_ctor(dbPath, { readonly });
    if (!readonly) {
      db.pragma('journal_mode = WAL');
      db.pragma(`busy_timeout = ${DB_BUSY_TIMEOUT_MS}`);
    }
    return db;
  } catch {
    return null;
  }
}
