import type BetterSqlite3 from 'better-sqlite3';
import type { McpContext } from '../mcp-tools.js';
import { RELATION_TYPES, SYMMETRIC_TYPES, type RelationType } from '../constants.js';
import { dbAll } from '../db-helpers.js';
import { assertSlugExists } from '../relation-helpers.js';

function runSymmetricAware(
  db: BetterSqlite3.Database,
  stmt: BetterSqlite3.Statement,
  a: string,
  b: string,
  type: RelationType,
): number {
  const isSymmetric = SYMMETRIC_TYPES.has(type) && a !== b;
  const txn = db.transaction(() => {
    const r1 = stmt.run(a, b, type);
    const r2 = isSymmetric ? stmt.run(b, a, type) : { changes: 0 };
    return r1.changes + r2.changes;
  });
  return txn();
}

export interface RelateInput {
  action: 'add' | 'remove' | 'list';
  source_a?: string;
  source_b?: string;
  relation_type?: RelationType;
  source?: string;
}

export interface AddResult { created: boolean; existing: boolean; relation: { source_a: string; source_b: string; relation_type: string } }
export interface RemoveResult { removed: boolean }
export interface ListResult { relations: Array<{ id: number; source_a: string; source_b: string; relation_type: string; created_at: string }>; total: number }
export type RelateResult = AddResult | RemoveResult | ListResult;

function validateRelationType(type: string): asserts type is RelationType {
  if (!(RELATION_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Invalid relation_type "${type}". Valid: ${RELATION_TYPES.join(', ')}`);
  }
}

export function handleRelate(ctx: McpContext, input: RelateInput): RelateResult {
  if (input.action === 'add') {
    if (!input.source_a || !input.source_b || !input.relation_type) {
      throw new Error('add requires source_a, source_b, and relation_type');
    }
    validateRelationType(input.relation_type);
    assertSlugExists(ctx.db, input.source_a);
    assertSlugExists(ctx.db, input.source_b);

    const insertStmt = ctx.db.prepare(
      'INSERT OR IGNORE INTO mindlore_relations (source_a, source_b, relation_type) VALUES (?, ?, ?)'
    );
    const totalChanges = runSymmetricAware(ctx.db, insertStmt, input.source_a, input.source_b, input.relation_type);

    return {
      created: totalChanges > 0,
      existing: totalChanges === 0,
      relation: { source_a: input.source_a, source_b: input.source_b, relation_type: input.relation_type },
    };
  }

  if (input.action === 'remove') {
    if (!input.source_a || !input.source_b || !input.relation_type) {
      throw new Error('remove requires source_a, source_b, and relation_type');
    }
    validateRelationType(input.relation_type);

    const deleteStmt = ctx.db.prepare(
      'DELETE FROM mindlore_relations WHERE source_a = ? AND source_b = ? AND relation_type = ?'
    );
    const totalChanges = runSymmetricAware(ctx.db, deleteStmt, input.source_a, input.source_b, input.relation_type);

    return { removed: totalChanges > 0 };
  }

  // list — both outgoing (source_a) and incoming (source_b) edges
  const query = input.source
    ? 'SELECT id, source_a, source_b, relation_type, created_at FROM mindlore_relations WHERE source_a = ? OR source_b = ? ORDER BY created_at DESC LIMIT 100'
    : 'SELECT id, source_a, source_b, relation_type, created_at FROM mindlore_relations ORDER BY created_at DESC LIMIT 100';

  const params = input.source ? [input.source, input.source] : [];
  const rows = dbAll<{ id: number; source_a: string; source_b: string; relation_type: string; created_at: string }>(ctx.db, query, ...params);

  return { relations: rows, total: rows.length };
}
