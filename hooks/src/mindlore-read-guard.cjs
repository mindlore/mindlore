#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { findMindloreDir, readHookStdin, getProjectName, hookLog, extractSkeleton, withTelemetrySync } = require('./lib/mindlore-common.cjs');
const { safeMkdir, safeWriteFile } = require('./lib/secure-io.cjs');
const { runReadGuard } = require('../../dist/scripts/lib/read-guard-core.js');

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;

  const filePath = readHookStdin(['file_path', 'path']);
  if (!filePath) return;

  const cwd = process.cwd();
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(cwd)) return;
  if (resolved.startsWith(path.resolve(baseDir))) return;

  const diaryDir = path.join(baseDir, 'diary');
  safeMkdir(diaryDir);

  const readsPath = path.join(diaryDir, `_session-reads-${getProjectName()}.json`);
  let reads = {};
  try {
    reads = JSON.parse(fs.readFileSync(readsPath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') hookLog('read-guard', 'warn', `read error: ${err.message}`);
    reads = {};
  }

  const decision = runReadGuard({ filePath: resolved, basename: path.basename(filePath) }, reads);
  reads[resolved] = decision.updatedReadsEntry;
  safeWriteFile(readsPath, JSON.stringify(reads, null, 2));

  if (decision.block) {
    process.stderr.write(decision.warning);
    process.exit(2);
  }

  if (decision.additionalContext) {
    let skeletonSection = '';
    try {
      const ext = path.extname(filePath).slice(1);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      if (fileContent.length < 500_000) {
        const skeleton = extractSkeleton(fileContent, ext);
        if (skeleton !== fileContent) {
          const truncated = skeleton.length > 2000 ? skeleton.slice(0, 2000) + '\n...[truncated]' : skeleton;
          skeletonSection = '\n\n' + truncated;
        }
      }
    } catch (_e) { /* unreadable/binary — skip */ }
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: decision.additionalContext + skeletonSection
      }
    }));
  }
}

try { withTelemetrySync('mindlore-read-guard', main); } catch (err) { hookLog('read-guard', 'error', err?.message ?? String(err)); }
