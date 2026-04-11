#!/usr/bin/env node
'use strict';

/**
 * mindlore-session-focus — SessionStart hook
 *
 * Injects last delta file content + INDEX.md into session context.
 * Fires once at session start via stdout additionalContext.
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir, getLatestDelta } = require('./lib/mindlore-common.cjs');

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return; // No .mindlore/ found, silently skip

  const output = [];

  // Inject INDEX.md
  const indexPath = path.join(baseDir, 'INDEX.md');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8').trim();
    output.push(`[Mindlore INDEX]\n${content}`);
  }

  // Inject latest delta
  const diaryDir = path.join(baseDir, 'diary');
  const latestDelta = getLatestDelta(diaryDir);
  if (latestDelta) {
    const deltaContent = fs.readFileSync(latestDelta, 'utf8').trim();
    const deltaName = path.basename(latestDelta);
    output.push(`[Mindlore Delta: ${deltaName}]\n${deltaContent}`);
  }

  // Version check: warn if installed mindlore is newer than .mindlore/.version
  const versionPath = path.join(baseDir, '.version');
  if (fs.existsSync(versionPath)) {
    try {
      const installed = fs.readFileSync(versionPath, 'utf8').trim();
      // Find package.json by walking up from this hook file
      const hookDir = __dirname;
      const pkgPath = path.resolve(hookDir, '..', 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.version && pkg.version !== installed) {
          output.push(`[Mindlore: Guncelleme mevcut (${installed} → ${pkg.version}). \`npx mindlore init\` calistirin.]`);
        }
      }
    } catch (_err) { /* skip */ }
  }

  if (output.length > 0) {
    process.stdout.write(output.join('\n\n') + '\n');
  }
}

main();
