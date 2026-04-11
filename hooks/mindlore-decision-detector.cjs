#!/usr/bin/env node
'use strict';

/**
 * mindlore-decision-detector — UserPromptSubmit hook
 *
 * Detects decision signals in user messages (TR + EN).
 * Outputs a suggestion to record the decision via /mindlore-decide.
 * Does NOT block (exit 0) — advisory only.
 */

const fs = require('fs');
const { findMindloreDir } = require('./lib/mindlore-common.cjs');

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

  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8').trim();
  } catch (_err) {
    return;
  }

  // Parse CC UserPromptSubmit stdin (may be JSON with prompt field or plain text)
  let userText = input;
  try {
    const parsed = JSON.parse(input);
    userText = parsed.prompt || parsed.content || parsed.message || input;
  } catch (_err) {
    // plain text input
  }

  if (!userText || userText.length < 10) return;

  const signal = detectDecision(userText);
  if (signal) {
    process.stdout.write(`[Mindlore: Karar sinyali tespit edildi ("${signal}") — /mindlore-decide record ile kaydetmek ister misin?]\n`);
  }
}

main();
