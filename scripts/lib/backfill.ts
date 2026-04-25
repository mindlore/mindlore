import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { resolveHookCommon } from './constants.js';

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- dynamic CJS require, typed by mindlore-common.d.cts
const common = require(resolveHookCommon(__dirname)) as {
  parseFrontmatter: (content: string) => { meta: Record<string, unknown>; body: string };
};

export interface BackfillResult {
  createdAtFixed: number;
  importanceMapped: number;
  projectScopeSet: number;
  totalRows: number;
}

function qualityToImportance(quality: string | undefined): number {
  switch (quality) {
    case 'high': return 1.0;
    case 'medium': return 0.6;
    case 'low': return 0.3;
    default: return 0.5;
  }
}

export function runBackfill(db: Database.Database, baseDir: string): BackfillResult {
  const result: BackfillResult = { createdAtFixed: 0, importanceMapped: 0, projectScopeSet: 0, totalRows: 0 };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .all() returns unknown[]
  const rows = db.prepare('SELECT path, last_indexed, created_at, importance, project_scope FROM file_hashes').all() as Array<{
    path: string; last_indexed: string; created_at: string | null; importance: number; project_scope: string | null;
  }>;
  result.totalRows = rows.length;

  const projectName = path.basename(baseDir);
  const updateCreatedAt = db.prepare('UPDATE file_hashes SET created_at = ? WHERE path = ?');
  const updateImportance = db.prepare('UPDATE file_hashes SET importance = ? WHERE path = ?');
  const updateProject = db.prepare('UPDATE file_hashes SET project_scope = ? WHERE path = ?');

  for (const row of rows) {
    if (!row.created_at) {
      updateCreatedAt.run(row.last_indexed, row.path);
      result.createdAtFixed++;
    }

    if (row.importance === 1.0 && fs.existsSync(row.path)) {
      try {
        const content = fs.readFileSync(row.path, 'utf8');
        const meta = common.parseFrontmatter(content).meta;
        if (meta.quality) {
          const mapped = qualityToImportance(String(meta.quality));
          if (mapped !== 1.0) {
            updateImportance.run(mapped, row.path);
            result.importanceMapped++;
          }
        } else {
          updateImportance.run(0.5, row.path);
          result.importanceMapped++;
        }
      } catch {
        // File not readable, skip
      }
    }

    if (!row.project_scope) {
      updateProject.run(projectName, row.path);
      result.projectScopeSet++;
    }
  }

  return result;
}
