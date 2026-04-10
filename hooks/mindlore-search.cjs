#!/usr/bin/env node
'use strict';

/**
 * mindlore-search — UserPromptSubmit hook
 *
 * Extracts keywords from user prompt, searches FTS5, injects top 3 results.
 * Results: file path + first 2 headings via stderr additionalContext.
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir, DB_NAME, requireDatabase } = require('./lib/mindlore-common.cjs');

const MAX_RESULTS = 3;
const MIN_QUERY_LENGTH = 3;

function extractKeywords(text) {
  // Remove common stop words and short words
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'between',
    'through', 'after', 'before', 'above', 'below', 'up', 'down', 'out',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too',
    'very', 'just', 'also', 'now', 'then', 'here', 'there', 'when',
    'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'this',
    'that', 'these', 'those', 'it', 'its', 'my', 'your', 'his', 'her',
    'our', 'their', 'me', 'him', 'us', 'them', 'i', 'you', 'he', 'she',
    'we', 'they', 'bu', 'su', 'bir', 'de', 'da', 've', 'ile', 'icin',
    'var', 'mi', 'ne', 'nasil', 'nedir', 'evet', 'hayir',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00e7\u011f\u0131\u00f6\u015f\u00fc\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= MIN_QUERY_LENGTH && !stopWords.has(w));

  // Deduplicate and limit
  return [...new Set(words)].slice(0, 5);
}

function extractHeadings(content, max) {
  const headings = [];
  for (const line of content.split('\n')) {
    if (line.startsWith('#')) {
      headings.push(line.replace(/^#+\s*/, '').trim());
      if (headings.length >= max) break;
    }
  }
  return headings;
}

function main() {
  // Read user prompt from stdin
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8');
  } catch (_err) {
    return;
  }

  let userMessage = '';
  try {
    const parsed = JSON.parse(input);
    userMessage = parsed.content || parsed.message || parsed.query || input;
  } catch (_err) {
    userMessage = input;
  }

  if (!userMessage || userMessage.length < MIN_QUERY_LENGTH) return;

  const baseDir = findMindloreDir();
  if (!baseDir) return;

  const dbPath = path.join(baseDir, DB_NAME);
  if (!fs.existsSync(dbPath)) return;

  const keywords = extractKeywords(userMessage);
  if (keywords.length === 0) return;

  const Database = requireDatabase();
  if (!Database) return;

  const db = new Database(dbPath, { readonly: true });

  try {
    // Build FTS5 query — OR between keywords
    const ftsQuery = keywords.join(' OR ');

    const results = db
      .prepare(
        `SELECT path, rank
         FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, MAX_RESULTS);

    if (results.length === 0) return;

    const output = [];
    for (const r of results) {
      const relativePath = path.relative(baseDir, r.path);
      let headings = [];

      if (fs.existsSync(r.path)) {
        const content = fs.readFileSync(r.path, 'utf8');
        headings = extractHeadings(content, 2);
      }

      const headingStr = headings.length > 0 ? ` — ${headings.join(', ')}` : '';
      output.push(`${relativePath}${headingStr}`);
    }

    if (output.length > 0) {
      process.stderr.write(
        `[Mindlore Search: ${keywords.join(', ')}]\n${output.join('\n')}\n`
      );
    }
  } catch (_err) {
    // FTS5 query error — silently skip
  } finally {
    db.close();
  }
}

main();
