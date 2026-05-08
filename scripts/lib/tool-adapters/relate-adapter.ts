import type { McpContext } from '../mcp-tools.js';
import { RELATION_TYPES, type RelationType } from '../constants.js';

interface RelateInput {
  action: 'add' | 'remove' | 'list';
  source_a?: string;
  source_b?: string;
  relation_type?: RelationType;
  source?: string;
}

interface AddResult { created: boolean; existing: boolean; relation: { source_a: string; source_b: string; relation_type: string } }
interface RemoveResult { removed: boolean }
interface ListResult { relations: Array<{ id: number; source_a: string; source_b: string; relation_type: string; created_at: string }>; total: number }
type RelateResult = AddResult | RemoveResult | ListResult;

function validateSlug(ctx: McpContext, slug: string): void {
  const row = ctx.db.prepare('SELECT 1 FROM mindlore_fts WHERE slug = ? LIMIT 1').get(slug);
  if (!row) throw new Error(`Source slug "${slug}" not found in knowledge base`);
}

function validateRelationType(type: string): asserts type is RelationType {
  if (!RELATION_TYPES.includes(type as RelationType)) {
    throw new Error(`Invalid relation_type "${type}". Valid: ${RELATION_TYPES.join(', ')}`);
  }
}

export function handleRelate(ctx: McpContext, input: RelateInput): RelateResult {
  if (input.action === 'add') {
    if (!input.source_a || !input.source_b || !input.relation_type) {
      throw new Error('add requires source_a, source_b, and relation_type');
    }
    validateRelationType(input.relation_type);
    validateSlug(ctx, input.source_a);
    validateSlug(ctx, input.source_b);

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

  // list
  const query = input.source
    ? 'SELECT id, source_a, source_b, relation_type, created_at FROM mindlore_relations WHERE source_a = ? ORDER BY created_at DESC'
    : 'SELECT id, source_a, source_b, relation_type, created_at FROM mindlore_relations ORDER BY created_at DESC';

  const params = input.source ? [input.source] : [];
  const rows = ctx.db.prepare(query).all(...params) as Array<{ id: number; source_a: string; source_b: string; relation_type: string; created_at: string }>;

  return { relations: rows, total: rows.length };
}
