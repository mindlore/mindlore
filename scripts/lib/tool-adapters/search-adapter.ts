import { search, extractKeywords } from '../search-engine.js';
import { extractSmartSnippet } from '../smart-snippet.js';
import type { McpContext } from '../mcp-tools.js';
import { MAX_RELATED_SOURCES } from '../constants.js';
import { errMsg } from '../err-msg.js';
import { getRelationsForSlugs, type RelatedSource as BaseRelatedSource } from '../relation-helpers.js';

interface SearchInput {
  query: string;
  limit?: number;
  scope?: string;
  contentType?: string;
}

interface RelatedSource extends BaseRelatedSource {
  via: string;
}

interface SearchOutput {
  results: Array<{
    title: string;
    slug: string;
    snippet: string;
    heading: string | null;
    score: number;
    path: string;
  }>;
  total: number;
  truncated: boolean;
  related: RelatedSource[];
}

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 5;
const MAX_SNIPPET_LEN = 500;

function getRelatedForSlugs(ctx: McpContext, slugs: string[], excludeSlugs: Set<string>): RelatedSource[] {
  if (slugs.length === 0) return [];

  const batch = getRelationsForSlugs(ctx.db, slugs);
  const all: RelatedSource[] = [];
  for (const [slug, rows] of batch.entries()) {
    for (const row of rows) {
      if (!excludeSlugs.has(row.source)) {
        all.push({ ...row, via: slug });
      }
    }
  }

  const seen = new Set<string>();
  const deduped: RelatedSource[] = [];
  for (const item of all) {
    const key = `${item.source}:${item.relation_type}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped.slice(0, MAX_RELATED_SOURCES);
}

export function handleSearch(ctx: McpContext, input: SearchInput): SearchOutput {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const results = search(ctx.db, input.query, { maxResults: limit });
  const keywords = extractKeywords(input.query);

  const mapped = results.map((r) => {
    const smart = r.content
      ? extractSmartSnippet(ctx.db, r.path, r.content, keywords, MAX_SNIPPET_LEN)
      : { snippet: r.description ?? '', heading: null };

    return {
      title: r.title,
      slug: r.slug,
      snippet: smart.snippet,
      heading: smart.heading,
      score: r.score,
      path: r.path,
    };
  });

  const slugList = mapped.map(r => r.slug);
  const resultSlugs = new Set(slugList);
  let related: RelatedSource[] = [];
  try {
    related = getRelatedForSlugs(ctx, slugList, resultSlugs);
  } catch (err) {
    const msg = errMsg(err);
    if (!msg.includes('no such table')) throw err;
  }

  return {
    results: mapped,
    total: mapped.length,
    truncated: results.length >= limit,
    related,
  };
}
