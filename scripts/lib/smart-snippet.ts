import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import { extractSnippet } from './snippet.js';
import { chunkMarkdown } from './chunker.js';

export interface SmartSnippetResult {
  snippet: string;
  heading: string | null;
}

interface ChunkRow {
  chunk_index: number;
  heading: string | null;
  breadcrumb: string;
  char_count: number;
}

export function extractSmartSnippet(
  db: Database,
  sourcePath: string,
  fullContent: string,
  terms: string[],
  maxLen = 500
): SmartSnippetResult {
  if (!fullContent || fullContent.length <= maxLen) {
    return { snippet: fullContent, heading: null };
  }

  let chunks: ChunkRow[];
  try {
    chunks = db.prepare(
      'SELECT chunk_index, heading, breadcrumb, char_count FROM chunks WHERE source_path = ? ORDER BY chunk_index'
    ).all(sourcePath) as ChunkRow[];
  } catch {
    return { snippet: extractSnippet(fullContent, terms, maxLen), heading: null };
  }

  if (chunks.length === 0) {
    return { snippet: extractSnippet(fullContent, terms, maxLen), heading: null };
  }

  const parsedChunks = chunkMarkdown(fullContent);
  const lowerTerms = terms.map(t => t.toLowerCase());

  let bestChunkIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < parsedChunks.length; i++) {
    const parsed = parsedChunks[i];
    if (!parsed) continue;
    const chunkLower = parsed.content.toLowerCase();
    const score = lowerTerms.filter(t => chunkLower.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      bestChunkIdx = i;
    }
  }

  if (bestChunkIdx === -1) {
    return { snippet: extractSnippet(fullContent, terms, maxLen), heading: null };
  }

  const bestParsed = parsedChunks[bestChunkIdx]!;
  const chunkSnippet = extractSnippet(bestParsed.content, terms, maxLen);
  const heading = chunks[bestChunkIdx]?.heading ?? bestParsed.heading ?? null;

  return { snippet: chunkSnippet, heading };
}
