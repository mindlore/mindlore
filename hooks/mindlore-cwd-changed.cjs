#!/usr/bin/env node
"use strict";

// hooks/src/mindlore-cwd-changed.cjs
var fs = require("fs");
var path = require("path");
var { findMindloreDir, globalDir, hookLog, withTelemetry } = require("./lib/mindlore-common.cjs");
var { safeMkdir, safeWriteFile } = require("./lib/secure-io.cjs");
function main() {
  const cwd = process.cwd();
  const activeDir = findMindloreDir();
  const scope = !activeDir ? "none" : activeDir.startsWith(globalDir()) ? "global" : "project";
  if (activeDir) {
    const diaryDir = path.join(activeDir, "diary");
    safeMkdir(diaryDir);
    const scopePath = path.join(diaryDir, "_scope.json");
    if (fs.existsSync(scopePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(scopePath, "utf8"));
        if (existing.cwd === cwd && existing.scope === scope) return;
      } catch (_err) {
      }
    }
    safeWriteFile(scopePath, JSON.stringify({
      scope,
      dir: activeDir,
      cwd,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2));
  }
  if (scope === "none") {
    process.stderr.write(`[Mindlore] Bu projede mindlore kurulu degil. npx mindlore init calistirin.
`);
  } else {
    process.stderr.write(`[Mindlore scope: ${scope}] ${activeDir}
`);
  }
}
withTelemetry("mindlore-cwd-changed", main).catch((err) => {
  hookLog("cwd-changed", "error", err?.message ?? String(err));
});
