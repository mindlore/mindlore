import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import { searchPorter, searchTrigram, computeRRF } from './rrf.js';
import { correctQuery } from './fuzzy.js';
import { rerankByProximity } from './proximity.js';
import { extractSnippet } from './snippet.js';
import { fixVersionTokens, STOP_WORDS, STOP_WORDS_MIN_LENGTH } from './constants.js';

export interface SearchOptions {
  project?: string;
  maxResults?: number;
  synonyms?: Record<string, string[]>;
}

export interface SearchResult {
  slug: string;
  path: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  score: number;
  snippet?: string;
  content?: string;
}

export function extractKeywords(text: string): string[] {
  return text
    .replace(/[^\w\sçğıöşüÇĞİÖŞÜ-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= STOP_WORDS_MIN_LENGTH && !STOP_WORDS.has(w.toLowerCase()))
    .map(w => w.toLowerCase());
}

function expandWithSynonyms(keywords: string[], synonyms?: Record<string, string[]>): string[] {
  if (!synonyms) return keywords;
  const expanded = [...keywords];
  for (const kw of keywords) {
    const syns = synonyms[kw];
    if (syns) expanded.push(...syns);
  }
  return expanded;
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  sources: 1.2,
  analyses: 1.15,
  domains: 1.1,
  episodes: 1.0,
  decisions: 1.0,
  raw: 0.9,
  sessions: 0.85,
  cc_memory: 1.3,
};

type Intent = 'debug' | 'research' | 'implementation';

const DEBUG_KEYWORDS = ['debug', 'fix', 'hata', 'bug', 'error', 'crash', 'fail'];
const RESEARCH_KEYWORDS = ['araştır', 'bul', 'search', 'nedir', 'nasıl', 'compare'];

function detectIntent(query: string): Intent {
  const lower = query.toLowerCase();
  if (DEBUG_KEYWORDS.some(k => lower.includes(k))) return 'debug';
  if (RESEARCH_KEYWORDS.some(k => lower.includes(k))) return 'research';
  return 'implementation';
}

const INTENT_BOOSTS: Record<Intent, Record<string, number>> = {
  debug: { episodes: 1.3, raw: 1.1 },
  research: { sources: 1.3, analyses: 1.2 },
  implementation: { domains: 1.2, sessions: 1.1 },
};

export function search(db: Database, query: string, options: SearchOptions): SearchResult[] {
  const maxResults = options.maxResults ?? 3;
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const expanded = expandWithSynonyms(keywords, options.synonyms);
  const queryStr = fixVersionTokens(expanded.join(' '));
  const limit = 20;

  function fusedSearch(q: string): ReturnType<typeof computeRRF> {
    return computeRRF(
      searchPorter(db, q, limit, options.project),
      searchTrigram(db, q, limit, options.project),
      { dedupByPath: true },
    );
  }

  let fused = fusedSearch(queryStr);

  if (fused.length === 0) {
    const corrected = correctQuery(db, keywords);
    if (corrected) {
      fused = fusedSearch(fixVersionTokens(corrected.join(' ')));
    }
  }

  const intent = detectIntent(query);
  const intentBoosts = INTENT_BOOSTS[intent];

  for (const r of fused) {
    r.score *= CATEGORY_WEIGHTS[r.category ?? ''] ?? 1.0;
    r.score *= intentBoosts[r.category ?? ''] ?? 1.0;
  }

  fused.sort((a, b) => b.score - a.score);

  const ranked = rerankByProximity(
    fused.map(r => ({
      slug: r.slug,
      path: r.path,
      title: r.title ?? '',
      description: r.description ?? '',
      category: r.category ?? '',
      tags: r.tags ?? '',
      score: r.score,
      content: r.content,
    })),
    keywords,
  );

  return ranked.slice(0, maxResults).map(r => ({
    ...r,
    snippet: r.content ? extractSnippet(r.content, keywords) : undefined,
  }));
}
