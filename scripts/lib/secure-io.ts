/**
 * R4 Convention: File I/O must happen BEFORE the DB transaction.
 * Pre-read data into memory, then run DB writes in a single transaction.
 * This prevents holding SQLite write locks during slow disk I/O.
 *
 * All secure file operations are centralized here.
 */

import fs from 'fs';

export function safeMkdir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}

export function safeWriteFile(filePath: string, data: string): void {
  fs.writeFileSync(filePath, data, { encoding: 'utf8', mode: 0o600 });
}

export function safeWriteJson(filePath: string, obj: unknown): void {
  safeWriteFile(filePath, JSON.stringify(obj, null, 2) + '\n');
}
