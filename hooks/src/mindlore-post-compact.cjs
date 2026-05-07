#!/usr/bin/env node
'use strict';

/**
 * mindlore-post-compact — PostCompact hook
 *
 * After context compaction, re-inject session context:
 * 1. Read INDEX.md
 * 2. Read latest delta
 * 3. Inject via stdout (same as session-focus)
 *
 * This ensures the agent has knowledge context after compaction.
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir, getLatestDelta, readConfig, hookLog, withTelemetry } = require('./lib/mindlore-common.cjs');

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

  const diaryDir = path.join(baseDir, 'diary');

  const latestDelta = getLatestDelta(diaryDir);
  if (latestDelta) {
    const deltaContent = fs.readFileSync(latestDelta, 'utf8').trim();
    const deltaName = path.basename(latestDelta);
    output.push(`[Mindlore Delta (post-compact): ${deltaName}]\n${deltaContent}`);
  }

  try {
    const snapshots = fs.readdirSync(diaryDir)
      .filter(f => f.startsWith('compaction-snapshot-'))
      .sort();
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[snapshots.length - 1];
      const snapshotContent = fs.readFileSync(
        path.join(diaryDir, latestSnapshot), 'utf8'
      ).trim();
      output.push(`[Mindlore Compaction Resume]\n${snapshotContent}`);
    }
  } catch (_err) { /* snapshot best-effort */ }

  if (output.length > 0) {
    const config = readConfig(baseDir);
    const budgetConfig = config?.tokenBudget ?? {};
    const maxInjectChars = (budgetConfig.sessionInject || 2000) * 4;
    let joined = output.join('\n\n');
    if (joined.length > maxInjectChars) {
      joined = joined.slice(0, maxInjectChars) + '\n[...truncated by token budget]';
    }
    process.stdout.write(joined + '\n');
  }
}

withTelemetry('mindlore-post-compact', main).catch(err => {
  hookLog('mindlore-post-compact', 'error', err?.message ?? String(err));
  process.exit(0);
});
