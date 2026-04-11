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
const { getAllDbs, requireDatabase, extractHeadings, readHookStdin } = require('./lib/mindlore-common.cjs');

const MAX_RESULTS = 3;
const MIN_QUERY_WORDS = 3;
const MIN_KEYWORD_HITS = 2;

// Extended stop words (~70 TR + EN) matching old knowledge system
const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'it', 'its', 'this', 'that', 'these', 'those', 'what', 'which', 'who',
  'whom', 'how', 'when', 'where', 'why', 'not', 'no', 'nor', 'so',
  'if', 'or', 'but', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than',
  'and', 'about', 'between', 'after', 'before', 'above', 'below',
  'up', 'down', 'out', 'very', 'just', 'also', 'now', 'then',
  'here', 'there', 'too', 'yet', 'my', 'your', 'his', 'her', 'our',
  'their', 'me', 'him', 'us', 'them', 'i', 'you', 'he', 'she', 'we', 'they',
  // Turkish
  'bir', 'bu', 'su', 'ne', 'nasil', 'neden', 'var', 'yok', 'mi', 'mu',
  'ile', 'icin', 'de', 'da', 've', 'veya', 'ama', 'ise', 'hem',
  'bakalim', 'gel', 'git', 'yap', 'et', 'al', 'ver',
  'evet', 'hayir', 'tamam', 'ok', 'oldu', 'olur', 'dur',
  'simdi', 'sonra', 'once', 'hemen', 'biraz',
  'lan', 'ya', 'ki', 'abi', 'hadi', 'hey', 'selam',
  'olarak', 'olan', 'gibi', 'kadar', 'daha', 'cok', 'hem',
  'bunu', 'buna', 'icinde', 'uzerinde', 'arasinda',
  'sonucu', 'tarafindan', 'zaten', 'gayet',
  'acaba', 'nedir', 'midir', 'mudur',
  // Generic technical (appears everywhere, not distinctive)
  'hook', 'file', 'dosya', 'kullan', 'ekle', 'yaz', 'oku', 'calistir',
  'kontrol', 'test', 'check', 'run', 'add', 'update', 'config',
  'setup', 'install', 'start', 'stop', 'create', 'delete', 'remove', 'set',
  'get', 'list', 'show', 'view', 'open', 'close', 'save', 'load',
]);

function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u00e7\u011f\u0131\u00f6\u015f\u00fc-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  return [...new Set(words)].slice(0, 8);
}

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
          const r = matchStmt.get(row.path, '"' + kw + '"');
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

function main() {
  const userMessage = readHookStdin(['prompt', 'content', 'message', 'query']);
  if (!userMessage || userMessage.length < MIN_QUERY_WORDS) return;

  const dbPaths = getAllDbs();
  if (dbPaths.length === 0) return;

  const keywords = extractKeywords(userMessage);
  if (keywords.length < MIN_QUERY_WORDS) return;

  const Database = requireDatabase();
  if (!Database) return;

  // Layered search: project DB first, global DB second
  // Project results appear first in output (higher priority)
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

  if (output.length > 0) {
    process.stdout.write(output.join('\n\n') + '\n');
  }
}

main();
