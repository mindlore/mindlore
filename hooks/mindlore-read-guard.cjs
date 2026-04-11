#!/usr/bin/env node
'use strict';

/**
 * mindlore-read-guard — PreToolUse hook (if: "Read")
 *
 * OpenWolf repeated-read pattern: detects files read multiple times
 * in the same session and emits a soft warning.
 * Does NOT block (exit 0) — advisory only.
 *
 * Storage: .mindlore/diary/_session-reads.json
 * Cleanup: session-end hook writes stats to delta then deletes the file.
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir, readHookStdin } = require('./lib/mindlore-common.cjs');

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

  const readsPath = path.join(diaryDir, '_session-reads.json');
  let reads = {};
  if (fs.existsSync(readsPath)) {
    try {
      reads = JSON.parse(fs.readFileSync(readsPath, 'utf8'));
    } catch (_err) {
      reads = {};
    }
  }

  const normalizedPath = path.resolve(filePath);
  const count = (reads[normalizedPath] || 0) + 1;
  reads[normalizedPath] = count;

  // Write updated reads
  fs.writeFileSync(readsPath, JSON.stringify(reads, null, 2), 'utf8');

  // Warn on repeated reads (2nd+ time)
  if (count > 1) {
    const basename = path.basename(filePath);
    process.stderr.write(`[Mindlore: ${basename} bu session'da ${count}. kez okunuyor. Değişiklik yoksa tekrar okumayı atlayabilirsin.]\n`);
  }
}

main();
