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
const { findMindloreDir, readConfig } = require('./lib/mindlore-common.cjs');

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

  // Inject latest delta + reflect trigger (single readdirSync)
  const diaryDir = path.join(baseDir, 'diary');
  if (fs.existsSync(diaryDir)) {
    try {
      const diaryFiles = fs.readdirSync(diaryDir).filter(f => f.startsWith('delta-') && f.endsWith('.md'));

      // Latest delta
      if (diaryFiles.length > 0) {
        const sorted = [...diaryFiles].sort();
        const latestName = sorted[sorted.length - 1];
        const latestPath = path.join(diaryDir, latestName);
        const deltaContent = fs.readFileSync(latestPath, 'utf8').trim();
        output.push(`[Mindlore Delta: ${latestName}]\n${deltaContent}`);
      }

      // Reflect trigger
      const config = readConfig(baseDir);
      const threshold = config?.reflect?.threshold ?? 5;
      if (diaryFiles.length >= threshold) {
        output.push(`[Mindlore] ${diaryFiles.length} diary entry birikti — \`/mindlore-log reflect\` calistirmayi dusun.`);
      }
    } catch (_err) { /* skip */ }
  }

  // Version check: compare .version (installed) vs .pkg-version (package)
  // Both are flat strings written by init — no JSON parse needed on session start
  const versionPath = path.join(baseDir, '.version');
  const pkgVersionPath = path.join(baseDir, '.pkg-version');
  try {
    if (fs.existsSync(versionPath) && fs.existsSync(pkgVersionPath)) {
      const installed = fs.readFileSync(versionPath, 'utf8').trim();
      const pkgVersion = fs.readFileSync(pkgVersionPath, 'utf8').trim();
      if (pkgVersion && pkgVersion !== installed) {
        output.push(`[Mindlore: Guncelleme mevcut (${installed} → ${pkgVersion}). \`npx mindlore init\` calistirin.]`);
      }
    }
  } catch (_err) { /* skip */ }

  if (output.length > 0) {
    process.stdout.write(output.join('\n\n') + '\n');
  }
}

main();
