import fs from 'fs';
import type { McpContext } from '../mcp-tools.js';
import { chunkMarkdown } from '../chunker.js';
import { slugify } from '../slugify.js';
import { SYMMETRIC_TYPES, buildPriorityCase, MAX_RELATED_SOURCES, RELATED_OVERFETCH } from '../constants.js';

interface GetInput {
  source: string;
  section?: string;
  include_relations?: boolean;
}

interface RelatedSource {
  source: string;
  relation_type: string;
  direction: 'outgoing' | 'incoming';
}

interface GetOutput {
  title: string;
  slug: string;
  content: string;
  section?: string;
  available_sections?: string[];
  relations?: RelatedSource[];
  metadata: { path: string; size: number };
}

function lookupSourcePath(ctx: McpContext, slug: string): { path: string; title: string } {
  const row = ctx.db.prepare('SELECT path, title FROM mindlore_fts WHERE slug = ? LIMIT 1').get(slug) as { path: string; title: string } | undefined;
  if (!row) throw new Error(`Source slug "${slug}" not found in knowledge base`);
  return row;
}

function getRelations(ctx: McpContext, slug: string): RelatedSource[] {
  const symmetricList = [...SYMMETRIC_TYPES].map(() => '?').join(',');
  const symmetricParams = [...SYMMETRIC_TYPES];
  const priorityCase = buildPriorityCase();

  const sql = `
    SELECT * FROM (
      SELECT source_b AS source, relation_type, 'outgoing' AS direction
      FROM mindlore_relations WHERE source_a = ?
      UNION ALL
      SELECT source_a AS source, relation_type, 'incoming' AS direction
      FROM mindlore_relations WHERE source_b = ? AND relation_type IN (${symmetricList})
    )
    ORDER BY CASE relation_type ${priorityCase} END
    LIMIT ?
  `;

  return ctx.db.prepare(sql).all(slug, slug, ...symmetricParams, RELATED_OVERFETCH) as RelatedSource[];
}

export function handleGet(ctx: McpContext, input: GetInput): GetOutput {
  const { path: sourcePath, title } = lookupSourcePath(ctx, input.source);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found on disk: ${sourcePath}`);
  }

  const raw = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
  const stat = fs.statSync(sourcePath);

  const result: GetOutput = {
    title,
    slug: input.source,
    content: raw,
    metadata: { path: sourcePath, size: stat.size },
  };

  if (input.section) {
    const chunks = chunkMarkdown(raw);
    const targetSlug = slugify(input.section);
    const match = chunks.find(c => c.heading && slugify(c.heading) === targetSlug);

    if (match) {
      result.content = match.content;
      result.section = match.heading!.replace(/^#+\s*/, '');
    } else {
      result.content = '';
      const sections = chunks.filter(c => c.heading).map(c => c.heading!.replace(/^#+\s*/, ''));
      if (sections.length > 0) result.available_sections = sections;
    }
  }

  const includeRelations = input.include_relations !== false;
  if (includeRelations) {
    const related = getRelations(ctx, input.source);
    const deduped = related.slice(0, MAX_RELATED_SOURCES);
    if (deduped.length > 0) result.relations = deduped;
  }

  return result;
}
