#!/usr/bin/env node
'use strict';

/**
 * mindlore-research-guard — PreToolUse (Agent) hook
 *
 * Before spawning a researcher agent, checks FTS5 for existing knowledge.
 * - High quality + recent (30 days) match → exit 2 (block)
 * - Old or low quality match → exit 0 with warning (additionalContext)
 * - No match → silent pass
 *
 * Prevents redundant web research when knowledge already exists in DB.
 */

const fs = require('fs');
const path = require('path');
const { getAllDbs, requireDatabase, extractKeywords, sanitizeKeyword, hookLog, withTelemetrySync } = require('./lib/mindlore-common.cjs');

// Keywords that signal a research/web-search intent in agent prompts
// Note: entries with dots/stars are regex patterns, rest are literals
const RESEARCH_SIGNALS = [
  'research', 'araştır', 'arastir', 'investigate', 'search for',
  'web search', 'websearch', 'webfetch', 'fetch.*url', 'look up',
  'find out', 'check.*docs', 'documentation.*for',
];
const RESEARCH_REGEX = new RegExp(RESEARCH_SIGNALS.join('|'), 'i');

// Exclude ingest/internal operations (they intentionally fetch URLs)
const EXCLUDE_REGEX = /\[mindlore:|\bmindlore-ingest\b|ingest.*url|save.*raw|\[research-override\]/i;

const MAX_AGE_DAYS = 30;

function isRecent(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= MAX_AGE_DAYS;
}

/**
 * Search FTS5 using a single OR query instead of per-path×keyword loop.
 * Returns top matches with quality and date from FTS5 columns (no file I/O).
 */
function searchDbs(keywords) {
  const Database = requireDatabase();
  if (!Database) return [];

  const sanitized = keywords.map(sanitizeKeyword).filter(Boolean);
  if (sanitized.length === 0) return [];

  const matchQuery = sanitized.join(' OR ');
  const dbPaths = getAllDbs();
  const results = [];

  for (const dbPath of dbPaths) {
    try {
      const db = new Database(dbPath, { readonly: true });

      // Single FTS5 query — O(1) instead of O(paths × keywords)
      const rows = db.prepare(
        `SELECT path, slug, title, description, quality, date_captured, rank
         FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 10`
      ).all(matchQuery);

      for (const row of rows) {
        const quality = (row.quality || 'medium').toLowerCase();
        const date_captured = row.date_captured || null;

        results.push({
          slug: row.slug || path.basename(row.path, '.md'),
          title: row.title || row.description || row.slug || '',
          quality,
          date_captured,
          recent: isRecent(date_captured),
          rank: row.rank,
        });
      }

      db.close();
    } catch (_err) { /* db open or query failed */ }
  }

  // Sort by rank (lower = better match in FTS5)
  results.sort((a, b) => a.rank - b.rank);
  return results.slice(0, 5);
}

function main() {
  let input;
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (!raw) return;
    input = JSON.parse(raw);
  } catch (_err) {
    return;
  }

  const toolName = input.tool_name || '';
  if (toolName !== 'Agent') return;

  const toolInput = input.tool_input || {};

  // Only block agents with web access — let local-only agents pass
  const WEB_CAPABLE_TYPES = ['researcher', 'general-purpose'];
  const LOCAL_ONLY_TYPES = [
    'Explore', 'coder', 'code-reviewer', 'Plan',
    'bug-analyzer', 'security-reviewer', 'contrarian',
    'scope-guardian', 'quality-gate', 'test-runner',
  ];
  const subagentType = toolInput.subagent_type || '';
  const description = (toolInput.description || '').toLowerCase();

  // Known local-only agent → always pass
  if (LOCAL_ONLY_TYPES.includes(subagentType)) return;

  // Known web-capable agent → continue to FTS5 check
  // Unknown or empty subagent_type → check description for research intent
  if (subagentType && !WEB_CAPABLE_TYPES.includes(subagentType)) return;

  // If no subagent_type, check description for web research intent (reuse RESEARCH_REGEX)
  if (!subagentType && !RESEARCH_REGEX.test(description)) return;

  const prompt = (toolInput.prompt || '') + ' ' + (toolInput.description || '');

  // Skip mindlore internal operations and explicit overrides
  if (EXCLUDE_REGEX.test(prompt)) return;

  // If subagent_type is a known research type, skip prompt-level regex check
  // Otherwise require research signals in the prompt text
  const isKnownResearchType = WEB_CAPABLE_TYPES.includes(subagentType);
  if (!isKnownResearchType && !RESEARCH_REGEX.test(prompt)) return;

  const keywords = extractKeywords(prompt, 10);
  if (keywords.length < 2) return;

  const matches = searchDbs(keywords);
  if (matches.length === 0) return;

  // Prevents false positives like "claude-code-repo" matching on generic words
  const lcKeywords = keywords.map((k) => k.toLowerCase());
  const relevantMatches = matches.filter((m) => {
    const haystack = `${m.slug} ${m.title}`.toLowerCase();
    const overlap = lcKeywords.filter((k) => haystack.includes(k));
    return overlap.length >= 2;
  });

  if (relevantMatches.length === 0) return;

  // Check for high-quality recent matches among relevant ones
  const strongMatches = relevantMatches.filter((m) => m.quality === 'high' && m.recent);

  if (strongMatches.length > 0) {
    const slugList = strongMatches.map((m) => `  - ${m.slug} (${m.title})`).join('\n');
    const msg = `[mindlore-research-guard] BLOK: Bu konuda guncel, yuksek kaliteli bilgi DB'de zaten var.\n` +
      `Once mevcut bilgiyi oku:\n${slugList}\n` +
      `Eger bilgi yetersizse, prompt'a "[research-override]" ekleyerek tekrar dene.`;
    process.stderr.write(msg);
    process.exit(2);
  }

  // WARN: relevant but old or low-quality matches exist
  const slugList = relevantMatches.map((m) => `${m.slug} (${m.quality}, ${m.date_captured || 'tarih yok'})`).join(', ');
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `[mindlore-research-guard] DB'de ilgili bilgi var ama eski/dusuk kalite: ${slugList}. Guncelleme gerekebilir — arastirma sonrasi DB'yi guncelle.`,
    },
  };
  process.stdout.write(JSON.stringify(output));
}

try { withTelemetrySync('mindlore-research-guard', main); } catch (err) { hookLog('research-guard', 'error', err?.message ?? String(err)); }
