#!/usr/bin/env node
'use strict';

/**
 * mindlore-post-compact — PostCompact hook
 *
 * After context compaction, re-inject session context:
 * 1. Read INDEX.md
 * 2. Read latest delta
 * 3. Inject via stderr (same as session-focus)
 *
 * This ensures the agent has knowledge context after compaction.
 */

const fs = require('fs');
const path = require('path');

const MINDLORE_DIR = '.mindlore';

function findMindloreDir() {
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
  if (!baseDir) return;

  const output = [];

  // Re-inject INDEX.md
  const indexPath = path.join(baseDir, 'INDEX.md');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8').trim();
    output.push(`[Mindlore INDEX (post-compact)]\n${content}`);
  }

  // Re-inject latest delta
  const diaryDir = path.join(baseDir, 'diary');
  const latestDelta = getLatestDelta(diaryDir);
  if (latestDelta) {
    const deltaContent = fs.readFileSync(latestDelta, 'utf8').trim();
    const deltaName = path.basename(latestDelta);
    output.push(`[Mindlore Delta (post-compact): ${deltaName}]\n${deltaContent}`);
  }

  if (output.length > 0) {
    process.stderr.write(output.join('\n\n') + '\n');
  }
}

main();
