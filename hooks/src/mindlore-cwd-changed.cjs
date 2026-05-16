#!/usr/bin/env node
'use strict';

/**
 * mindlore-cwd-changed — CwdChanged hook
 *
 * Fires when user changes working directory.
 * CwdChanged has NO inject to Claude — stdout is swallowed, stderr shown to user.
 *
 * Side effects:
 *   1. Detect scope (global ~/.mindlore/ or none)
 *   2. Write scope state to .mindlore/diary/_scope.json for session-focus to read
 *   3. Show user-facing message via stderr
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir, globalDir, hookLog, withTelemetry } = require('./lib/mindlore-common.cjs');
const { safeMkdir, safeWriteFile } = require('./lib/secure-io.cjs');

function main() {
  const cwd = process.cwd();
  const activeDir = findMindloreDir();
  const scope = !activeDir ? 'none' : activeDir.startsWith(globalDir()) ? 'global' : 'project';

  if (activeDir) {
    const diaryDir = path.join(activeDir, 'diary');
    safeMkdir(diaryDir);

    // Dirty-check: skip write if scope hasn't changed
    const scopePath = path.join(diaryDir, '_scope.json');
    if (fs.existsSync(scopePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
        if (existing.cwd === cwd && existing.scope === scope) return;
      } catch (_err) {
        // corrupt file — overwrite
      }
    }

    safeWriteFile(scopePath, JSON.stringify({
      scope,
      dir: activeDir,
      cwd,
      timestamp: new Date().toISOString(),
    }, null, 2));
  }

  if (scope === 'none') {
    process.stderr.write(`[Mindlore] Bu projede mindlore kurulu degil. npx mindlore init calistirin.\n`);
  } else {
    process.stderr.write(`[Mindlore scope: ${scope}] ${activeDir}\n`);
  }
}

withTelemetry('mindlore-cwd-changed', main).catch(err => { hookLog('cwd-changed', 'error', err?.message ?? String(err)); });
