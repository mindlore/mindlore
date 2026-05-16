#!/usr/bin/env node
'use strict';

/**
 * mindlore-search — UserPromptSubmit hook
 *
 * Thin wrapper over search-engine.ts pipeline.
 * Extracts keywords from user prompt, delegates search to modular engine,
 * injects top results with description + headings.
 */

const fs = require('fs');
const path = require('path');
const { getAllDbs, openDatabase, extractHeadings, readConfig, hookLog, incrementRecallCount, withTelemetry } = require('./lib/mindlore-common.cjs');
const { safeMkdir, safeWriteFile } = require('./lib/secure-io.cjs');

const MAX_RESULTS = 3;
const MIN_QUERY_WORDS = 3;

let searchEngineMod;
try {
  searchEngineMod = require('../dist/scripts/lib/search-engine.js');
} catch (_err) {
  // search-engine not built yet
}

let SearchCacheMod;
try {
  SearchCacheMod = require('../dist/scripts/lib/search-cache.js');
} catch (_err) {
  // search-cache not built yet
}

let TokenEstimatorMod;
try {
  TokenEstimatorMod = require('../dist/scripts/lib/transcript-token-estimator.js');
} catch (_err) {
  // estimator not built yet
}

function parseStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (!raw) return { userMessage: '', sessionId: 'unknown', transcriptPath: undefined };
    const parsed = JSON.parse(raw);
    const userMessage = parsed.prompt || parsed.content || parsed.message || parsed.query || raw;
    const sessionId = parsed.session_id || 'unknown';
    const transcriptPath = parsed.transcript_path || parsed.transcriptPath;
    return { userMessage, sessionId, transcriptPath };
  } catch (_err) {
    return { userMessage: '', sessionId: 'unknown', transcriptPath: undefined };
  }
}

function getBaseMax(transcriptPath) {
  if (TokenEstimatorMod) {
    try {
      return TokenEstimatorMod.adaptiveResultCount(transcriptPath);
    } catch (_err) {
      // fall through to default
    }
  }
  return MAX_RESULTS;
}

function main() {
  const { userMessage, sessionId, transcriptPath } = parseStdin();
  if (!userMessage || userMessage.length < MIN_QUERY_WORDS) return;
  const baseMax = getBaseMax(transcriptPath);
  let searchMs = 0;

  const dbPaths = getAllDbs();
  if (dbPaths.length === 0) return;

  if (!searchEngineMod) {
    hookLog('search', 'warn', 'search-engine module not available — skipping');
    return;
  }

  const project = path.basename(process.cwd());
  const config = readConfig(path.dirname(dbPaths[0]));
  const synonyms = (config && config.synonyms) ? config.synonyms : {};

  const allResults = [];
  // Track tightest throttle cap across DBs — applied to the final result slice
  // so cache hits (which return previously-stored arrays) still respect throttle
  // state in subsequent calls of the same session.
  let sessionEffectiveMax = baseMax;
  for (const dbPath of dbPaths) {
    const db = openDatabase(dbPath);
    if (!db) continue;
    try {
      // Cache + throttle
      let cache;
      let effectiveMax = baseMax;
      if (SearchCacheMod) {
        cache = new SearchCacheMod.SearchCache(db, { ttlMs: 300000 });
        const throttle = new SearchCacheMod.SearchThrottle(db);
        const callCount = throttle.incrementCallCount(sessionId);
        // Throttle is baseMax-aware: when callCount <= 10 it returns baseMax,
        // so adaptive expansion (up to 5 in low-context sessions) is honored.
        // Above 10 calls it clamps to 1, above 20 to 0 (skip).
        effectiveMax = throttle.getMaxResults(callCount, baseMax);
        if (effectiveMax < sessionEffectiveMax) sessionEffectiveMax = effectiveMax;
        if (effectiveMax === 0) {
          hookLog('search', 'info', `Throttled (call #${callCount})`);
          db.close();
          continue;
        }
        const cached = cache.get(userMessage);
        if (cached) {
          const baseDir = path.dirname(dbPath);
          for (const r of cached.slice(0, effectiveMax)) allResults.push({ ...r, baseDir });
          db.close();
          continue;
        }
      }

      const t0 = Date.now();
      const results = searchEngineMod.search(db, userMessage, {
        project,
        maxResults: effectiveMax,
        synonyms,
      });
      searchMs += Date.now() - t0;

      if (cache) cache.set(userMessage, results);

      const baseDir = path.dirname(dbPath);
      for (const r of results) {
        allResults.push({ ...r, baseDir });
      }

      // Recall count inside loop — avoid reopening DB
      try {
        const txn = db.transaction(() => {
          for (const r of results) incrementRecallCount(db, r.path);
        });
        txn();
      } catch (_e) { /* graceful */ }
    } catch (err) {
      hookLog('search', 'warn', `Search error: ${err?.message || err}`);
    } finally {
      db.close();
    }
  }

  // Deduplicate by full path
  const seen = new Set();
  const unique = [];
  for (const r of allResults) {
    const normalized = path.resolve(r.path);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(r);
    }
  }

  // Sort by score descending, take top N
  unique.sort((a, b) => b.score - a.score);
  const relevant = unique.slice(0, sessionEffectiveMax);
  if (relevant.length === 0) return;

  // Token budget from config
  const budget = (config && config.tokenBudget) || {};
  const perResultChars = ((budget.perResult || 500) * 4);
  const totalChars = ((budget.searchResults || 1500) * 4);

  // Build output
  const output = [];
  let totalUsed = 0;
  for (const r of relevant) {
    if (totalUsed >= totalChars) break;
    const relativePath = path.relative(r.baseDir, r.path).replace(/\\/g, '/');

    let headings = [];
    const contentStr = r.content || '';
    if (contentStr) {
      try {
        headings = extractHeadings(contentStr, 3);
      } catch (_err) { /* skip */ }
    }

    const category = r.category || path.dirname(relativePath).split('/')[0];
    const title = r.title || r.slug || path.basename(r.path, '.md');
    const description = r.description || '';

    const headingStr = headings.length > 0 ? `\nBasliklar: ${headings.join(', ')}` : '';
    const tagsStr = r.tags ? `\nTags: ${r.tags}` : '';
    const snippetOrDesc = r.snippet || description;
    const entry = `[Mindlore: ${category}/${title}] ${snippetOrDesc}\nDosya: ${relativePath}${tagsStr}${headingStr}`;
    const truncated = entry.slice(0, perResultChars);
    totalUsed += truncated.length;
    output.push(truncated);
  }

  if (output.length > 0) {
    let outputStr = output.join('\n\n') + '\n';

    const OFFLOAD_THRESHOLD = 10240;
    if (outputStr.length > OFFLOAD_THRESHOLD) {
      const baseDir = path.dirname(dbPaths[0]);
      const tmpDir = path.join(baseDir, 'tmp');
      safeMkdir(tmpDir);

      try {
        const oneHourAgo = Date.now() - 3600000;
        const files = fs.readdirSync(tmpDir)
          .filter(f => f.startsWith('search-'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(tmpDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);
        for (let i = 0; i < files.length; i++) {
          if (i >= 20 || files[i].mtime < oneHourAgo) {
            try { fs.unlinkSync(path.join(tmpDir, files[i].name)); } catch { /* ignore */ }
          }
        }
      } catch { /* cleanup is best-effort */ }
      const fileName = `search-${Date.now()}.md`;
      const filePath = path.join(tmpDir, fileName);
      safeWriteFile(filePath, outputStr);

      const summary = outputStr.slice(0, 500).replace(/\n/g, ' ').trim();
      outputStr = `[Mindlore Search: ${outputStr.length} chars offloaded to ${filePath}]\n` +
                  `Summary: ${summary}...\n` +
                  `[Read full results: ${filePath}]`;
      hookLog('search', 'info', 'offloaded to tmp/ (' + outputStr.length + ' chars)');
    }

    process.stdout.write(outputStr);
  }
  return { search_ms: searchMs, result_count: relevant.length };
}

withTelemetry('mindlore-search', main).catch(err => {
  hookLog('mindlore-search', 'error', err?.message ?? String(err));
  process.exit(0);
});
