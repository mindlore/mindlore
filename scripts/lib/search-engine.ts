import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import { searchPorter, searchTrigram, computeRRF } from './rrf.js';
import { correctQuery } from './fuzzy.js';
import { rerankByProximity } from './proximity.js';
import { extractSnippet } from './snippet.js';
import { fixVersionTokens, STOP_WORDS, STOP_WORDS_MIN_LENGTH, TURKISH_WORD_RE } from './constants.js';

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
    .replace(TURKISH_WORD_RE, ' ')
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

interface IntentConfig {
  keywords: string[];
  boosts: Record<string, number>;
}

const INTENT_CONFIG: Record<Intent, IntentConfig> = {
  debug: {
    keywords: ['debug', 'fix', 'hata', 'bug', 'error', 'crash', 'fail'],
    boosts: { episodes: 1.3, raw: 1.1 },
  },
  research: {
    keywords: ['araştır', 'bul', 'search', 'nedir', 'nasıl', 'compare'],
    boosts: { sources: 1.3, analyses: 1.2 },
  },
  implementation: {
    keywords: [],
    boosts: { domains: 1.2, sessions: 1.1 },
  },
};

function detectIntent(query: string): Intent {
  const lower = query.toLowerCase();
  for (const [intent, config] of Object.entries(INTENT_CONFIG)) {
    if (config.keywords.some(k => lower.includes(k))) return intent as Intent;
  }
  return 'implementation';
}

export function search(db: Database, query: string, options: SearchOptions): SearchResult[] {
  const maxResults = options.maxResults ?? 3;
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const expanded = expandWithSynonyms(keywords, options.synonyms);
  const queryStr = fixVersionTokens(expanded.join(' '));
  const limit = 20;

  function fusedSearch(q: string): ReturnType<typeof computeRRF> {
    return computeRRF(
      searchPorter(db, { query: q, limit, project: options.project }),
      searchTrigram(db, { query: q, limit, project: options.project }),
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
  const intentBoosts = INTENT_CONFIG[intent].boosts;

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
