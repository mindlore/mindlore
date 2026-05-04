import { search, extractKeywords } from '../search-engine.js';
import { extractSmartSnippet } from '../smart-snippet.js';
import type { McpContext } from '../mcp-tools.js';

interface SearchInput {
  query: string;
  limit?: number;
  scope?: string;
  contentType?: string;
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
}

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 5;
const MAX_SNIPPET_LEN = 500;

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

  return {
    results: mapped,
    total: mapped.length,
    truncated: results.length >= limit,
  };
}
