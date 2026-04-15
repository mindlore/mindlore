/**
 * Type-safe wrappers for better-sqlite3 queries.
 * Centralizes the single unavoidable `as T` cast — better-sqlite3's
 * .get() and .all() return `unknown` by design.
 */
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

import { VEC_TABLE_NAME, EMBEDDING_DIM_CONST } from './constants.js';

/**
 * Typed wrapper for Statement.get().
 * Returns undefined if no row matches.
 */
export function dbGet<T extends Record<string, unknown>>(
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
export function dbAll<T extends Record<string, unknown>>(
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
 * Load sqlite-vec extension into the database.
 * Returns true if loaded, false if sqlite-vec is not available.
 */
export function loadSqliteVec(db: Database): boolean {
  try {
    const sqliteVec: { load: (db: unknown) => void } = require('sqlite-vec');
    sqliteVec.load(db);
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Create documents_vec virtual table if it doesn't exist.
 * Requires sqlite-vec to be loaded first.
 * Silently does nothing if vec0 is not available.
 */
export function ensureVecTable(db: Database): boolean {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${VEC_TABLE_NAME} USING vec0(
        embedding float[${EMBEDDING_DIM_CONST}],
        slug text,
        +created_at text,
        +model_name text
      )
    `);
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Check if documents_vec table exists and is functional.
 */
export function hasVecTable(db: Database): boolean {
  try {
    db.prepare(`SELECT slug FROM ${VEC_TABLE_NAME} LIMIT 0`).run();
    return true;
  } catch (_err) {
    return false;
  }
}
