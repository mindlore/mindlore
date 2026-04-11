#!/usr/bin/env node
'use strict';

/**
 * mindlore-post-read — PostToolUse hook (matcher: "Read")
 *
 * After a file is read, estimate its token count
 * and store in _session-reads.json for the read-guard to reference.
 *
 * Does NOT output anything (pure bookkeeping).
 * PostToolUse stdout goes to debug log only — no inject needed.
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir } = require('./lib/mindlore-common.cjs');

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.css', '.scss', '.sql', '.sh', '.yaml', '.yml', '.json', '.toml', '.xml', '.cjs', '.mjs']);
const PROSE_EXTS = new Set(['.md', '.txt', '.rst', '.adoc']);

function estimateTokens(charCount, ext) {
  const ratio = CODE_EXTS.has(ext) ? 3.5 : PROSE_EXTS.has(ext) ? 4.0 : 3.75;
  return Math.ceil(charCount / ratio);
}

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;

  let input = '';
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('error', () => process.exit(0));
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    try {
      const data = JSON.parse(input || '{}');
      const toolInput = data.tool_input || {};
      const toolOutput = data.tool_output || {};

      const filePath = toolInput.file_path || toolInput.path || '';
      if (!filePath) return process.exit(0);

      // Skip .mindlore/ internals
      const resolved = path.resolve(filePath);
      if (resolved.startsWith(path.resolve(baseDir))) return process.exit(0);

      // Get content length from tool output or read file
      let charCount = 0;
      if (toolOutput.content) {
        charCount = typeof toolOutput.content === 'string'
          ? toolOutput.content.length
          : JSON.stringify(toolOutput.content).length;
      } else {
        // Fallback: read file size
        try {
          const stat = fs.statSync(resolved);
          charCount = stat.size;
        } catch { return process.exit(0); }
      }

      if (charCount === 0) return process.exit(0);

      const ext = path.extname(filePath).toLowerCase();
      const tokens = estimateTokens(charCount, ext);

      // Update _session-reads.json with token info
      const diaryDir = path.join(baseDir, 'diary');
      const readsPath = path.join(diaryDir, '_session-reads.json');
      let reads = {};
      if (fs.existsSync(readsPath)) {
        try { reads = JSON.parse(fs.readFileSync(readsPath, 'utf8')); } catch { reads = {}; }
      }

      const normalizedPath = path.resolve(filePath);
      const key = normalizedPath;

      if (typeof reads[key] === 'number') {
        // Upgrade from old format (just count) to new format (object)
        reads[key] = { count: reads[key], tokens, chars: charCount };
      } else if (reads[key] && typeof reads[key] === 'object') {
        reads[key].tokens = tokens;
        reads[key].chars = charCount;
      } else {
        reads[key] = { count: 1, tokens, chars: charCount };
      }

      fs.writeFileSync(readsPath, JSON.stringify(reads, null, 2), 'utf8');
    } catch {
      // Silent fail
    }
    process.exit(0);
  });
}

main();
