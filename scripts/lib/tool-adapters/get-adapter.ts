import fs from 'fs';
import type { McpContext } from '../mcp-tools.js';
import { chunkMarkdown } from '../chunker.js';
import { slugify } from '../slugify.js';
import { MAX_RELATED_SOURCES } from '../constants.js';
import { dbGet } from '../db-helpers.js';
import { getRelationsForSlug, type RelatedSource } from '../relation-helpers.js';

export interface GetInput {
  source: string;
  section?: string;
  include_relations?: boolean;
}

export interface GetOutput {
  title: string;
  slug: string;
  content: string;
  section?: string;
  available_sections?: string[];
  relations?: RelatedSource[];
  metadata: { path: string; size: number };
}

function lookupSourcePath(ctx: McpContext, slug: string): { path: string; title: string } {
  const row = dbGet<{ path: string; title: string }>(ctx.db, 'SELECT path, title FROM mindlore_fts WHERE slug = ? LIMIT 1', slug);
  if (!row) throw new Error(`Source slug "${slug}" not found in knowledge base`);
  return row;
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
    const related = getRelationsForSlug(ctx.db, input.source, MAX_RELATED_SOURCES);
    if (related.length > 0) result.relations = related;
  }

  return result;
}
