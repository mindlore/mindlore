#!/usr/bin/env node
'use strict';

/**
 * mindlore-read-guard — PreToolUse hook (if: "Read")
 *
 * Repeated-read detection: detects files read multiple times
 * in the same session and emits a soft warning.
 * Does NOT block (exit 0) — advisory only.
 *
 * Storage: .mindlore/diary/_session-reads.json
 * Cleanup: session-end hook writes stats to delta then deletes the file.
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir, readHookStdin, getProjectName, hookLog } = require('./lib/mindlore-common.cjs');

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;

  const filePath = readHookStdin(['file_path', 'path']);
  if (!filePath) return;

  // Only track CWD-relative files, skip .mindlore/ internals
  const cwd = process.cwd();
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(cwd)) return;
  if (resolved.startsWith(path.resolve(baseDir))) return;

  // Load or create session reads tracker
  const diaryDir = path.join(baseDir, 'diary');
  if (!fs.existsSync(diaryDir)) {
    fs.mkdirSync(diaryDir, { recursive: true });
  }

  const readsPath = path.join(diaryDir, `_session-reads-${getProjectName()}.json`);
  let reads = {};
  if (fs.existsSync(readsPath)) {
    try {
      reads = JSON.parse(fs.readFileSync(readsPath, 'utf8'));
    } catch (_err) {
      reads = {};
    }
  }

  const normalizedPath = path.resolve(filePath);
  const existing = reads[normalizedPath];

  // Support both old format (number) and new format (object with tokens)
  let count, tokens;
  if (typeof existing === 'number') {
    count = existing + 1;
    tokens = 0;
    reads[normalizedPath] = { count, tokens: 0, chars: 0 };
  } else if (existing && typeof existing === 'object') {
    count = (existing.count || 0) + 1;
    tokens = existing.tokens || 0;
    existing.count = count;
    reads[normalizedPath] = existing;
  } else {
    count = 1;
    tokens = 0;
    reads[normalizedPath] = { count, tokens: 0, chars: 0 };
  }

  // Write updated reads
  fs.writeFileSync(readsPath, JSON.stringify(reads, null, 2), 'utf8');

  const basename = path.basename(filePath);
  const tokenInfo = tokens > 0 ? ` (~${tokens} token)` : '';

  // Block on 3+ repeated reads (exit 2 = block tool call)
  if (count >= 3) {
    const totalWaste = tokens > 0 ? ` Toplam israf: ~${tokens * (count - 1)} token.` : '';
    process.stderr.write(`[Mindlore BLOCK] ${basename}${tokenInfo} bu session'da ${count}. kez okunuyor.${totalWaste} Edit icin gerekiyorsa once degisikligini yap, sonra tekrar oku. Analiz icin ctx_execute_file kullan.`);
    process.exit(2);
  }

  // Warn on 2nd read (exit 0 = allow but warn)
  if (count > 1) {
    const totalWaste = tokens > 0 ? ` Toplam tekrar: ~${tokens * (count - 1)} token.` : '';
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: `[Mindlore: ${basename}${tokenInfo} bu session'da ${count}. kez okunuyor.${totalWaste} Bir sonraki okuma engellenecek — Edit gerekiyorsa simdi yap.]`
      }
    }));
  }
}

try { main(); } catch (err) { hookLog('read-guard', 'error', err?.message ?? String(err)); }
