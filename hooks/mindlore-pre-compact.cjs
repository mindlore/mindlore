#!/usr/bin/env node
'use strict';

/**
 * mindlore-pre-compact — PreCompact hook
 *
 * Before context compaction:
 * 1. Ensure FTS5 index is up to date
 * 2. Write pre-compact episode to episodes/ and append log entry
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir, hookLog, withTelemetry } = require('./lib/mindlore-common.cjs');

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;

  // Trigger FTS5 sync via the index script
  const indexScript = path.join(__dirname, '..', 'scripts', 'mindlore-fts5-index.cjs');
  if (fs.existsSync(indexScript)) {
    try {
      const { spawnSync } = require('child_process');
      spawnSync('node', [indexScript, baseDir], {
        timeout: 10000,
        stdio: 'pipe',
      });
    } catch (_err) {
      // Non-fatal — index might fail if better-sqlite3 not available
    }
  }

  const now = new Date();
  const iso = now.toISOString();

  // Write pre-compact episode
  const episodesDir = path.join(baseDir, 'episodes');
  try {
    const ts = iso.replace(/[:.]/g, '-');
    const episodePath = path.join(episodesDir, `pre-compact-${ts}.md`);
    const content = [
      '---',
      'type: episode',
      'subtype: pre-compact',
      `date: ${iso.slice(0, 10)}`,
      `project: ${path.basename(process.cwd())}`,
      '---',
      '',
      `Pre-compact snapshot at ${iso}.`,
      `Working directory: ${process.cwd()}`,
    ].join('\n');
    fs.writeFileSync(episodePath, content, 'utf8');
  } catch (_err) { /* episodes dir may not exist */ }

  // Append log entry
  const logPath = path.join(baseDir, 'log.md');
  try {
    const entry = `| ${iso.slice(0, 10)} | pre-compact | FTS5 flush before compaction |\n`;
    fs.appendFileSync(logPath, entry, 'utf8');
  } catch (_err) { /* log file may not exist */ }

  process.stdout.write('[Mindlore: pre-compact FTS5 flush complete]\n');
}

withTelemetry('mindlore-pre-compact', main).catch(err => {
  if (process.env.MINDLORE_DEBUG === '1') process.stderr.write(`[mindlore-pre-compact] ${err.message}\n`);
  process.exit(0);
});
