#!/usr/bin/env node
'use strict';

/**
 * mindlore-cwd-changed — CwdChanged hook
 *
 * Fires when user changes working directory.
 * CwdChanged has NO inject to Claude — stdout is swallowed, stderr shown to user.
 *
 * Side effects:
 *   1. Detect scope (project .mindlore/ vs global ~/.mindlore/)
 *   2. Write scope state to .mindlore/diary/_scope.json for session-focus to read
 *   3. Show user-facing message via stderr
 */

const fs = require('fs');
const path = require('path');
const { MINDLORE_DIR, globalDir } = require('./lib/mindlore-common.cjs');

function main() {
  const cwd = process.cwd();
  const projectDir = path.join(cwd, MINDLORE_DIR);
  const gDir = globalDir();

  const hasProject = fs.existsSync(projectDir);
  const hasGlobal = fs.existsSync(gDir);

  const scope = hasProject ? 'project' : hasGlobal ? 'global' : 'none';
  const activeDir = hasProject ? projectDir : hasGlobal ? gDir : null;

  // Write scope state for session-focus to pick up
  if (activeDir) {
    const diaryDir = path.join(activeDir, 'diary');
    if (!fs.existsSync(diaryDir)) {
      fs.mkdirSync(diaryDir, { recursive: true });
    }
    const scopePath = path.join(diaryDir, '_scope.json');
    fs.writeFileSync(scopePath, JSON.stringify({
      scope,
      dir: activeDir,
      cwd,
      timestamp: new Date().toISOString(),
    }, null, 2), 'utf8');
  }

  // User-facing message via stderr (Claude won't see this)
  if (scope === 'none') {
    process.stderr.write(`[Mindlore] Bu projede mindlore kurulu degil. npx mindlore init calistirin.\n`);
  } else {
    process.stderr.write(`[Mindlore scope: ${scope}] ${activeDir}\n`);
  }
}

main();
