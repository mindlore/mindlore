import type { McpContext } from '../mcp-tools.js';
import { RELATION_TYPES, type RelationType } from '../constants.js';
import { dbAll } from '../db-helpers.js';
import { assertSlugExists } from '../relation-helpers.js';

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

    const result = ctx.db.prepare(
      'INSERT OR IGNORE INTO mindlore_relations (source_a, source_b, relation_type) VALUES (?, ?, ?)'
    ).run(input.source_a, input.source_b, input.relation_type);

    return {
      created: result.changes > 0,
      existing: result.changes === 0,
      relation: { source_a: input.source_a, source_b: input.source_b, relation_type: input.relation_type },
    };
  }

  if (input.action === 'remove') {
    if (!input.source_a || !input.source_b || !input.relation_type) {
      throw new Error('remove requires source_a, source_b, and relation_type');
    }
    validateRelationType(input.relation_type);
    const result = ctx.db.prepare(
      'DELETE FROM mindlore_relations WHERE source_a = ? AND source_b = ? AND relation_type = ?'
    ).run(input.source_a, input.source_b, input.relation_type);

    return { removed: result.changes > 0 };
  }

  // list — both outgoing (source_a) and incoming (source_b) edges
  const query = input.source
    ? 'SELECT id, source_a, source_b, relation_type, created_at FROM mindlore_relations WHERE source_a = ? OR source_b = ? ORDER BY created_at DESC LIMIT 100'
    : 'SELECT id, source_a, source_b, relation_type, created_at FROM mindlore_relations ORDER BY created_at DESC LIMIT 100';

  const params = input.source ? [input.source, input.source] : [];
  const rows = dbAll<{ id: number; source_a: string; source_b: string; relation_type: string; created_at: string }>(ctx.db, query, ...params);

  return { relations: rows, total: rows.length };
}
