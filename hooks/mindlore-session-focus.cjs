#!/usr/bin/env node
'use strict';

/**
 * mindlore-session-focus — SessionStart hook
 *
 * Injects last delta file content + INDEX.md into session context.
 * Fires once at session start via stderr additionalContext.
 */

const fs = require('fs');
const path = require('path');

const MINDLORE_DIR = '.mindlore';

function findMindloreDir() {
  // Check project dir first, then global
  const projectDir = path.join(process.cwd(), MINDLORE_DIR);
  if (fs.existsSync(projectDir)) return projectDir;

  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const globalDir = path.join(homeDir, MINDLORE_DIR);
  if (fs.existsSync(globalDir)) return globalDir;

  return null;
}

function getLatestDelta(diaryDir) {
  if (!fs.existsSync(diaryDir)) return null;

  const deltas = fs
    .readdirSync(diaryDir)
    .filter((f) => f.startsWith('delta-') && f.endsWith('.md'))
    .sort()
    .reverse();

  if (deltas.length === 0) return null;
  return path.join(diaryDir, deltas[0]);
}

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

  if (output.length > 0) {
    process.stderr.write(output.join('\n\n') + '\n');
  }
}

main();
