#!/usr/bin/env node
'use strict';

/**
 * mindlore-session-end — SessionEnd hook
 *
 * Writes a basic delta file to diary/ with session timestamp.
 * v0.1: minimal delta (timestamp + marker)
 * v0.2: structured delta with stats, decisions, learnings
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

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}${min}`;
}

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;

  const diaryDir = path.join(baseDir, 'diary');
  if (!fs.existsSync(diaryDir)) {
    fs.mkdirSync(diaryDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = formatDate(now);
  const deltaPath = path.join(diaryDir, `delta-${dateStr}.md`);

  // Don't overwrite existing delta (idempotent)
  if (fs.existsSync(deltaPath)) return;

  const content = [
    '---',
    `slug: delta-${dateStr}`,
    'type: diary',
    `date: ${now.toISOString().slice(0, 10)}`,
    '---',
    '',
    `# Session Delta — ${dateStr}`,
    '',
    `Session ended: ${now.toISOString()}`,
    '',
    '## Changes',
    '',
    '_No structured changes tracked in v0.1. Upgrade to v0.2 for detailed deltas._',
    '',
  ].join('\n');

  fs.writeFileSync(deltaPath, content, 'utf8');

  // Append to log.md
  const logPath = path.join(baseDir, 'log.md');
  if (fs.existsSync(logPath)) {
    const logEntry = `| ${now.toISOString().slice(0, 10)} | session-end | delta-${dateStr}.md |\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
  }
}

main();
