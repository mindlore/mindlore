#!/usr/bin/env node
'use strict';

/**
 * mindlore-dont-repeat — PreToolUse hook (matcher: "Write|Edit")
 *
 * Checks code being written against negative rules (DON'T, NEVER, AVOID, YAPMA, etc.)
 * found in LESSONS files and Mindlore learnings/.
 *
 * Sources checked (in order):
 *   1. ~/.claude/lessons/global.md (global rules)
 *   2. ./LESSONS.md (project-level rules, if exists)
 *   3. .mindlore/learnings/*.md (Mindlore learnings, if exists)
 *
 * Advisory only (exit 0) — does not block, injects additionalContext warning.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { findMindloreDir, getProjectName, hookLog, withTelemetrySync } = require('./lib/mindlore-common.cjs');

/**
 * File-persisted pattern cache — survives across process invocations.
 * Cache file: .mindlore/diary/_pattern-cache.json
 * Each entry keyed by source file path, stores mtimeMs + extracted patterns.
 * On hit: stat only, no readFile+parse. On miss: read, parse, update cache.
 */

let cacheDirty = false;

function readCache(cachePath) {
  if (!cachePath) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (_err) {
    return {};
  }
}

function writeCache(cachePath, cache) {
  if (!cachePath || !cacheDirty) return;
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
  } catch (_err) { /* write failure is non-fatal */ }
}

function loadPatterns(filePath, cache) {
  try {
    const stat = fs.statSync(filePath);
    const mtimeMs = stat.mtimeMs;
    const cached = cache[filePath];
    if (cached && cached.mtimeMs === mtimeMs) return cached.patterns;

    const patterns = extractNegativePatterns(fs.readFileSync(filePath, 'utf8'));
    cache[filePath] = { mtimeMs, patterns };
    cacheDirty = true;
    return patterns;
  } catch (_err) {
    return [];
  }
}

function extractNegativePatterns(content) {
  const patterns = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Multi-language: TR (YAPMA, KRITIK) + EN (DON'T, NEVER, AVOID, DO NOT)
    const isNegativeRule = /^-\s*(YAPMA|KRITIK|DON'?T|NEVER|AVOID|DO NOT):/i.test(trimmed);
    if (!isNegativeRule) continue;

    // Extract backtick-quoted code patterns: `pattern`
    const backtickMatches = trimmed.match(/`([^`]+)`/g);
    if (backtickMatches) {
      for (const match of backtickMatches) {
        const pattern = match.slice(1, -1).trim();
        // Skip short/generic patterns — too many false positives
        if (pattern.length < 8) continue;
        if (/^[^a-zA-Z0-9]+$/.test(pattern)) continue;
        // Skip single words (too generic: "node", "bash", "any")
        if (/^\w+$/.test(pattern) && pattern.length < 12) continue;
        // Skip file extensions and paths
        if (/^\.\w{1,5}$/.test(pattern)) continue;
        if (pattern.startsWith('/') || pattern.startsWith('~')) continue;
        if (pattern.includes('.md') || pattern.includes('.json')) continue;
        // Skip common false-positive patterns
        if (/^(node|bash|npm|git|process|require|import|export|const|let|var)$/i.test(pattern)) continue;

        patterns.push({
          pattern,
          rule: trimmed.substring(0, 120),
        });
      }
    }

    // Extract "quoted strings" as patterns
    const quoteMatches = trimmed.match(/"([^"]+)"/g);
    if (quoteMatches) {
      for (const match of quoteMatches) {
        const quoted = match.slice(1, -1).trim();
        if (quoted.length < 4) continue;
        patterns.push({
          pattern: quoted,
          rule: trimmed.substring(0, 120),
        });
      }
    }
  }

  return patterns;
}

function checkContent(content, patterns) {
  const matches = [];
  for (const p of patterns) {
    try {
      const escaped = p.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      if (regex.test(content)) {
        matches.push(p);
      }
    } catch { /* skip invalid patterns */ }
  }
  return matches;
}

function main() {
  let input = '';
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('error', () => process.exit(0));
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    try {
      const data = JSON.parse(input || '{}');
      const toolName = data.tool_name || '';

      if (!['Write', 'Edit'].includes(toolName)) {
        return process.exit(0);
      }

      const toolInput = data.tool_input || {};
      const filePath = toolInput.file_path || '';

      // Skip non-code files
      if (!filePath) return process.exit(0);
      const ext = path.extname(filePath).toLowerCase();
      const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.sh', '.yaml', '.yml'];
      if (!codeExts.includes(ext)) return process.exit(0);

      // Skip rule files themselves
      const basename = path.basename(filePath);
      if (basename === 'LESSONS.md' || basename === 'global.md' || basename === 'CLAUDE.md') {
        return process.exit(0);
      }

      // Collect content being written (skip old_string — that's code being removed, not added)
      const allContent = [
        toolInput.content || '',
        toolInput.new_string || '',
      ].join('\n');

      if (allContent.trim().length < 10) return process.exit(0);

      // Load patterns from all sources (file-persisted mtime cache)
      const mindloreDir = findMindloreDir();
      const cachePath = mindloreDir ? path.join(mindloreDir, 'diary', `_pattern-cache-${getProjectName()}.json`) : null;
      const cache = readCache(cachePath);
      const allPatterns = [];
      const cwd = process.cwd();

      // 1. Global lessons
      allPatterns.push(...loadPatterns(path.join(os.homedir(), '.claude', 'lessons', 'global.md'), cache));

      // 2. Project LESSONS.md
      allPatterns.push(...loadPatterns(path.join(cwd, 'LESSONS.md'), cache));

      // 3. Mindlore learnings/ directory
      if (mindloreDir) {
        const learningsDir = path.join(mindloreDir, 'learnings');
        try {
          const files = fs.readdirSync(learningsDir).filter(f => f.endsWith('.md'));
          for (const file of files) {
            allPatterns.push(...loadPatterns(path.join(learningsDir, file), cache));
          }
        } catch (_err) { /* learnings/ doesn't exist yet */ }
      }

      writeCache(cachePath, cache);

      if (allPatterns.length === 0) return process.exit(0);

      // Check content against patterns
      const matches = checkContent(allContent, allPatterns);
      if (matches.length === 0) return process.exit(0);

      // Build warning — max 3 matches shown
      const shown = matches.slice(0, 3);
      const warning = shown.map(m =>
        `  - Pattern: \`${m.pattern}\` → ${m.rule}`
      ).join('\n');
      const extra = matches.length > 3 ? `\n  ... and ${matches.length - 3} more` : '';

      const msg = `[Mindlore: ${matches.length} dont-repeat rule violation detected]\n${warning}${extra}`;

      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: msg
        }
      }));
    } catch {
      // Silent fail
    }
    process.exit(0);
  });
}

try { withTelemetrySync('mindlore-dont-repeat', main); } catch (err) { hookLog('dont-repeat', 'error', err?.message ?? String(err)); }
