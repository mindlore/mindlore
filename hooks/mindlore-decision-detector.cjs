#!/usr/bin/env node
"use strict";

// hooks/src/mindlore-decision-detector.cjs
var { findMindloreDir, readHookStdin, hookLog, withTelemetry } = require("./lib/mindlore-common.cjs");
var SIGNALS_TR = [
  "karar verdik",
  "karar verildi",
  "kararlastirdik",
  "kararla\u015Ft\u0131rd\u0131k",
  "\u015Funu se\xE7tik",
  "sunu sectik",
  "bunu yapmayal\u0131m",
  "bunu yapmayalim",
  "yerine",
  "tercih ettik",
  "onaylandi",
  "onayland\u0131",
  "kesinle\u015Fti",
  "kesinlesti",
  "vazge\xE7tik",
  "vazgectik",
  "iptal ettik"
];
var SIGNALS_EN = [
  "decided",
  "decision made",
  "let's go with",
  "lets go with",
  "we'll use",
  "well use",
  "approved",
  "settled on",
  "going with",
  "chosen",
  "finalized",
  "rejected"
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
  const userText = readHookStdin(["prompt", "content", "message"]);
  if (!userText || userText.length < 10) return;
  const signal = detectDecision(userText);
  if (signal) {
    process.stdout.write(`[Mindlore: Karar sinyali tespit edildi ("${signal}") \u2014 /mindlore-decide record ile kaydetmek ister misin?]
`);
  }
}
withTelemetry("mindlore-decision-detector", main).catch((err) => {
  hookLog("mindlore-decision-detector", "error", err?.message ?? String(err));
  process.exit(0);
});
