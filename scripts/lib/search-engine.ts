import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import { searchPorter, searchTrigram, computeRRF } from './rrf.js';
import { correctQuery } from './fuzzy.js';
import { rerankByProximity } from './proximity.js';
import { extractSmartSnippet } from './smart-snippet.js';
import { getRelationsForSlugs } from './relation-helpers.js';
import { dbAll } from './db-helpers.js';
import { fixVersionTokens, STOP_WORDS, STOP_WORDS_MIN_LENGTH, TURKISH_WORD_RE, Category } from './constants.js';

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
  heading?: string | null;
  content?: string;
}

export function extractKeywords(text: string, maxKeywords?: number): string[] {
  const keywords = text
    .replace(TURKISH_WORD_RE, ' ')
    .split(/\s+/)
    .filter(w => w.length >= STOP_WORDS_MIN_LENGTH && !STOP_WORDS.has(w.toLowerCase()))
    .map(w => w.toLowerCase());
  return maxKeywords ? keywords.slice(0, maxKeywords) : keywords;
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

const CATEGORY_WEIGHTS: Partial<Record<Category, number>> = {
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
  boosts: Partial<Record<Category, number>>;
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Object.keys cast triggers lint; keep in sync with INTENT_CONFIG
const INTENT_KEYS = Object.keys(INTENT_CONFIG) as Intent[];

function detectIntent(query: string): Intent {
  const lower = query.toLowerCase();
  for (const intent of INTENT_KEYS) {
    if (INTENT_CONFIG[intent].keywords.some(k => lower.includes(k))) return intent;
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
    const porterResults = searchPorter(db, { query: q, limit, project: options.project });
    const trigramResults = searchTrigram(db, { query: q, limit, project: options.project });

    const candidateSlugs = Array.from(new Set([
      ...porterResults.map(r => r.slug),
      ...trigramResults.map(r => r.slug),
    ]));

    let recallMap: Map<string, number> | undefined;
    let relationGraph: Map<string, Set<string>> | undefined;
    try {
      recallMap = new Map<string, number>();
      if (candidateSlugs.length > 0) {
        const placeholders = candidateSlugs.map(() => '?').join(',');
        const rows = dbAll<{ slug: string; recall_count: number }>(db, `
          SELECT f.slug, h.recall_count
          FROM file_hashes h
          JOIN mindlore_fts f ON f.path = h.path
          WHERE f.slug IN (${placeholders})
        `, ...candidateSlugs);
        for (const r of rows) {
          recallMap.set(r.slug, r.recall_count ?? 0);
        }
      }

      const relationsBySlug = getRelationsForSlugs(db, candidateSlugs);
      relationGraph = new Map<string, Set<string>>();
      const candidateSet = new Set(candidateSlugs);
      for (const [slug, rels] of relationsBySlug.entries()) {
        const neighbors = new Set<string>();
        for (const r of rels) {
          if (candidateSet.has(r.source)) neighbors.add(r.source);
        }
        relationGraph.set(slug, neighbors);
      }
    } catch (_e) {
      // Graceful fallback when tables/columns are missing
      recallMap = undefined;
      relationGraph = undefined;
    }

    return computeRRF(porterResults, trigramResults, recallMap, relationGraph, { dedupByPath: true });
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DB category value matches Category union
    r.score *= CATEGORY_WEIGHTS[r.category as Category] ?? 1.0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DB category value matches Category union
    r.score *= intentBoosts[r.category as Category] ?? 1.0;
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

  return ranked.slice(0, maxResults).map(r => {
    const smart = r.content ? extractSmartSnippet(db, r.path, r.content, keywords) : undefined;
    return {
      ...r,
      snippet: smart?.snippet,
      heading: smart?.heading ?? null,
    };
  });
}
