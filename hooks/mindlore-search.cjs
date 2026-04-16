#!/usr/bin/env node
'use strict';

/**
 * mindlore-search — UserPromptSubmit hook
 *
 * Extracts keywords from user prompt, searches FTS5 with per-keyword scoring,
 * injects top results with description + headings (matching old knowledge system quality).
 */

const fs = require('fs');
const path = require('path');
const { getAllDbs, requireDatabase, extractHeadings, readHookStdin, extractKeywords, sanitizeKeyword, readConfig, loadSqliteVecCjs, hasVecTableCjs, hookLog } = require('./lib/mindlore-common.cjs');

const MAX_RESULTS = 3;
const MIN_QUERY_WORDS = 3;

// Try to load hybrid search module (built TS)
let hybridSearchMod;
try {
  hybridSearchMod = require('../dist/scripts/lib/hybrid-search.js');
} catch (_err) {
  // hybrid-search not built yet — pure FTS5 mode
}

/**
 * Search a single DB and return scored results with their baseDir.
 */
function searchDb(dbPath, keywords, Database) {
  const baseDir = path.dirname(dbPath);
  const db = new Database(dbPath, { readonly: true });
  const results = [];

  // v0.5.0: Try hybrid search with synonym expansion (no embedding — hooks are sync)
  if (hybridSearchMod && loadSqliteVecCjs(db) && hasVecTableCjs(db)) {
    try {
      const config = readConfig(baseDir);
      const synonyms = (config && config.synonyms) ? config.synonyms : {};

      // Expand keywords with synonyms
      const expandedTerms = keywords.slice();
      for (const kw of keywords) {
        const lower = kw.toLowerCase();
        if (synonyms[lower]) {
          expandedTerms.push(...synonyms[lower]);
        }
      }

      const fusedResults = hybridSearchMod.hybridSearch(db, expandedTerms.join(' '), {
        maxResults: MAX_RESULTS,
        project: path.basename(process.cwd()),
      });

      if (fusedResults.length > 0) {
        for (const r of fusedResults) {
          const filePath = r.path || '';
          let headings = [];
          if (filePath && fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            headings = extractHeadings(content, 3);
          }
          results.push({
            path: filePath,
            slug: r.slug,
            description: r.description || '',
            category: r.category || '',
            title: r.title || '',
            tags: r.tags || '',
            headings,
            hits: 1,
            rank: r.score,
            baseDir,
          });
        }
        db.close();
        return results;
      }
    } catch (_err) {
      // Hybrid search failed — fall through to FTS5
    }
  }

  // FTS5-only fallback: OR-joined single query (replaces O(docs×keywords) nested loop)
  try {
    const sanitized = keywords.map(sanitizeKeyword).filter(Boolean);
    if (sanitized.length === 0) { db.close(); return results; }

    const ftsQuery = sanitized.join(' OR ');
    const rows = db.prepare(
      `SELECT path, slug, description, category, title, tags, rank
       FROM mindlore_fts WHERE mindlore_fts MATCH ? ORDER BY rank LIMIT ?`
    ).all(ftsQuery, MAX_RESULTS * 2);

    for (const r of rows) {
      results.push({
        path: r.path || '',
        slug: r.slug,
        description: r.description || '',
        category: r.category || '',
        title: r.title || '',
        tags: r.tags || '',
        headings: [],  // populated later in main() after slicing
        hits: sanitized.length,
        rank: r.rank,
        baseDir,
      });
    }
  } catch (_err) {
    // FTS5 query error — silently skip
  } finally {
    db.close();
  }

  return results;
}

/**
 * Search episodes via FTS5 mirror (type = 'episode').
 * Reuses an already-open DB handle — no extra sqlite3_open.
 */
function searchEpisodesFts(db, keywords) {
  try {
    const ftsQuery = keywords.map(sanitizeKeyword).filter(Boolean).join(' OR ');
    const rows = db.prepare(
      "SELECT title, category, slug, tags FROM mindlore_fts WHERE type = 'episode' AND mindlore_fts MATCH ? LIMIT 2"
    ).all(ftsQuery);

    return rows.map(r => {
      const tags = r.tags || '';
      const kind = tags.split(',')[0]?.trim() || 'episode';
      return `[episode] ${kind}: ${r.title || r.slug}`;
    });
  } catch (_err) {
    return [];
  }
}

function main() {
  const userMessage = readHookStdin(['prompt', 'content', 'message', 'query']);
  if (!userMessage || userMessage.length < MIN_QUERY_WORDS) return;

  const dbPaths = getAllDbs();
  if (dbPaths.length === 0) return;

  const keywords = extractKeywords(userMessage);
  if (keywords.length < MIN_QUERY_WORDS) return;

  const Database = requireDatabase();
  if (!Database) return;

  const allScores = [];
  for (const dbPath of dbPaths) {
    allScores.push(...searchDb(dbPath, keywords, Database));
  }

  // Sort: most keyword hits first, then best rank
  allScores.sort((a, b) => b.hits - a.hits || a.totalRank - b.totalRank);

  // Deduplicate by full path (project version wins — appears first in sort)
  const seen = new Set();
  const unique = [];
  for (const r of allScores) {
    const normalized = path.resolve(r.path);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(r);
    }
  }

  const relevant = unique.slice(0, MAX_RESULTS);
  if (relevant.length === 0) return;

  // Populate headings only for final results (avoid reading extra files)
  for (const r of relevant) {
    if (r.path && r.headings.length === 0 && fs.existsSync(r.path)) {
      try {
        const content = fs.readFileSync(r.path, 'utf8');
        r.headings = extractHeadings(content, 3);
      } catch (_err) { /* skip */ }
    }
  }

  // Token budget from config
  const config = readConfig(path.dirname(dbPaths[0]));
  const budget = (config && config.tokenBudget) || {};
  // Defaults match DEFAULT_TOKEN_BUDGET in scripts/lib/constants.ts
  const perResultChars = ((budget.perResult || 500) * 4); // ~4 chars/token
  const totalChars = ((budget.searchResults || 1500) * 4);

  // Build rich inject output
  const output = [];
  let totalUsed = 0;
  for (const r of relevant) {
    if (totalUsed >= totalChars) break;
    const meta = r.meta || {};
    const relativePath = path.relative(r.baseDir, r.path).replace(/\\/g, '/');

    const headings = r.headings || [];

    const category = meta.category || path.dirname(relativePath).split('/')[0];
    const title = meta.title || meta.slug || path.basename(r.path, '.md');
    const description = meta.description || '';

    const headingStr = headings.length > 0 ? `\nBasliklar: ${headings.join(', ')}` : '';
    const tagsStr = meta.tags ? `\nTags: ${meta.tags}` : '';
    const entry = `[Mindlore: ${category}/${title}] ${description}\nDosya: ${relativePath}${tagsStr}${headingStr}`;
    const truncated = entry.slice(0, perResultChars);
    totalUsed += truncated.length;
    output.push(truncated);
  }

  // v0.4.0: Search episode mirrors in FTS5 (reuses searchDb's DB path, no extra open)
  if (relevant.length < MAX_RESULTS) {
    for (const dbPath of dbPaths) {
      try {
        const db = new Database(dbPath, { readonly: true });
        const episodeResults = searchEpisodesFts(db, keywords);
        db.close();
        if (episodeResults.length > 0) {
          output.push(`[Mindlore Episodes]\n${episodeResults.join('\n')}`);
          break;
        }
      } catch (_err) { /* skip */ }
    }
  }

  if (output.length > 0) {
    process.stdout.write(output.join('\n\n') + '\n');
  }
}

try { main(); } catch (err) { hookLog('search', 'error', err?.message ?? String(err)); }
