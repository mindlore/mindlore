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
const { getAllDbs, requireDatabase, extractHeadings, readHookStdin, extractKeywords } = require('./lib/mindlore-common.cjs');

const MAX_RESULTS = 3;
const MIN_QUERY_WORDS = 3;
const MIN_KEYWORD_HITS = 2;

/**
 * Search a single DB and return scored results with their baseDir.
 */
function searchDb(dbPath, keywords, Database) {
  const baseDir = path.dirname(dbPath);
  const db = new Database(dbPath, { readonly: true });
  const results = [];

  try {
    const allPaths = db.prepare('SELECT DISTINCT path FROM mindlore_fts').all();
    const matchStmt = db.prepare('SELECT rank FROM mindlore_fts WHERE path = ? AND mindlore_fts MATCH ?');
    const metaStmt = db.prepare(
      'SELECT slug, description, category, title, tags FROM mindlore_fts WHERE path = ?'
    );

    for (const row of allPaths) {
      let hits = 0;
      let totalRank = 0;

      for (const kw of keywords) {
        try {
          const sanitized = kw.replace(/["*(){}[\]^~:]/g, '');
          if (!sanitized) continue;
          const r = matchStmt.get(row.path, '"' + sanitized + '"');
          if (r) {
            hits++;
            totalRank += r.rank;
          }
        } catch (_err) {
          // FTS5 query error for this keyword — skip
        }
      }

      if (hits >= MIN_KEYWORD_HITS) {
        const meta = metaStmt.get(row.path) || {};
        results.push({ path: row.path, hits, totalRank, baseDir, meta });
      }
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
    const ftsQuery = keywords.map(kw => '"' + kw.replace(/["*(){}[\]^~:]/g, '') + '"').filter(q => q !== '""').join(' OR ');
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

  // Build rich inject output
  const output = [];
  for (const r of relevant) {
    const meta = r.meta || {};
    const relativePath = path.relative(r.baseDir, r.path).replace(/\\/g, '/');

    let headings = [];
    if (fs.existsSync(r.path)) {
      const content = fs.readFileSync(r.path, 'utf8');
      headings = extractHeadings(content, 5);
    }

    const category = meta.category || path.dirname(relativePath).split('/')[0];
    const title = meta.title || meta.slug || path.basename(r.path, '.md');
    const description = meta.description || '';

    const headingStr = headings.length > 0 ? `\nBasliklar: ${headings.join(', ')}` : '';
    const tagsStr = meta.tags ? `\nTags: ${meta.tags}` : '';
    output.push(
      `[Mindlore: ${category}/${title}] ${description}\nDosya: ${relativePath}${tagsStr}${headingStr}`
    );
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

main();
