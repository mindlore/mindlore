import fs from 'fs';
import type { McpContext } from '../mcp-tools.js';
import { chunkMarkdown } from '../chunker.js';
import { slugify } from '../slugify.js';
import { MAX_RELATED_SOURCES } from '../constants.js';
import { assertSlugExists, getRelationsForSlug, type RelatedSource } from '../relation-helpers.js';

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

export function handleGet(ctx: McpContext, input: GetInput): GetOutput {
  const { path: sourcePath, title } = assertSlugExists(ctx.db, input.source);

  let raw: string;
  try {
    raw = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    throw new Error(`Source file not found on disk: ${sourcePath}`);
  }
  const size = Buffer.byteLength(raw, 'utf8');

  const result: GetOutput = {
    title,
    slug: input.source,
    content: raw,
    metadata: { path: sourcePath, size },
  };

  if (input.section) {
    const chunks = chunkMarkdown(raw);
    const targetSlug = slugify(input.section);
    const match = chunks.find(c => c.heading && slugify(c.heading) === targetSlug);

    if (match) {
      result.content = match.content;
      const heading = match.heading;
      if (!heading) throw new Error('expected match.heading to exist');
      result.section = heading.replace(/^#+\s*/, '');
    } else {
      result.content = '';
      const sections = chunks.filter(c => c.heading).map(c => {
        const heading = c.heading;
        if (!heading) throw new Error('expected c.heading to exist');
        return heading.replace(/^#+\s*/, '');
      });
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
