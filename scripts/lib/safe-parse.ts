/**
 * Type-safe JSON parsing with runtime validation.
 * Eliminates `JSON.parse(...) as Type` pattern.
 */
import fs from 'fs';

/**
 * Parse JSON and validate the result is a non-null object.
 * Throws TypeError on non-object results.
 */
export function parseJsonObject<T extends Record<string, unknown>>(raw: string): T {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(`Expected JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- centralized cast: runtime-validated object
  return parsed as T;
}

/**
 * Read a JSON file and return as typed object.
 * Combines fs.readFileSync + parseJsonObject.
 */
export function readJsonFile<T extends Record<string, unknown>>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parseJsonObject<T>(raw);
}
