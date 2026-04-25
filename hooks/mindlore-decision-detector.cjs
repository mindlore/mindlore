#!/usr/bin/env node
'use strict';

/**
 * mindlore-decision-detector — UserPromptSubmit hook
 *
 * Detects decision signals in user messages (TR + EN).
 * Outputs a suggestion to record the decision via /mindlore-decide.
 * Does NOT block (exit 0) — advisory only.
 */

const { findMindloreDir, readHookStdin, hookLog, withTelemetry } = require('./lib/mindlore-common.cjs');

const SIGNALS_TR = [
  'karar verdik', 'karar verildi', 'kararlastirdik', 'kararlaştırdık',
  'şunu seçtik', 'sunu sectik', 'bunu yapmayalım', 'bunu yapmayalim',
  'yerine', 'tercih ettik', 'onaylandi', 'onaylandı', 'kesinleşti', 'kesinlesti',
  'vazgeçtik', 'vazgectik', 'iptal ettik',
];

const SIGNALS_EN = [
  'decided', 'decision made', "let's go with", 'lets go with',
  "we'll use", 'well use', 'approved', 'settled on',
  'going with', 'chosen', 'finalized', 'rejected',
];

function detectDecision(text) {
  const lower = text.toLowerCase();
  for (const signal of SIGNALS_TR) {
    if (lower.includes(signal)) return signal;
  }
  for (const signal of SIGNALS_EN) {
    if (lower.includes(signal)) return signal;
  }
  return null;
}

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;

  const userText = readHookStdin(['prompt', 'content', 'message']);
  if (!userText || userText.length < 10) return;

  const signal = detectDecision(userText);
  if (signal) {
    process.stdout.write(`[Mindlore: Karar sinyali tespit edildi ("${signal}") — /mindlore-decide record ile kaydetmek ister misin?]\n`);
  }
}

withTelemetry('mindlore-decision-detector', main).catch(err => {
  hookLog('mindlore-decision-detector', 'error', err?.message ?? String(err));
  process.exit(0);
});
