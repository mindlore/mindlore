#!/usr/bin/env node
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// dist/scripts/lib/read-guard-core.js
var require_read_guard_core = __commonJS({
  "dist/scripts/lib/read-guard-core.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.runReadGuard = runReadGuard2;
    function runReadGuard2(input, existingReads) {
      const normalizedPath = input.filePath;
      const existing = existingReads[normalizedPath];
      let count;
      let tokens;
      if (typeof existing === "number") {
        count = existing + 1;
        tokens = 0;
      } else if (existing && typeof existing === "object") {
        count = (existing.count || 0) + 1;
        tokens = existing.tokens || 0;
      } else {
        count = 1;
        tokens = 0;
      }
      const updatedReadsEntry = { count, tokens, chars: 0 };
      existingReads[normalizedPath] = updatedReadsEntry;
      if (count >= 3) {
        const totalWaste = tokens > 0 ? ` Toplam israf: ~${tokens * (count - 1)} token.` : "";
        return {
          block: true,
          warning: `[Mindlore BLOCK] ${input.basename} bu session'da ${count}. kez okunuyor.${totalWaste} Edit icin gerekiyorsa once degisikligini yap, sonra tekrar oku. Analiz icin ctx_execute_file kullan.`,
          updatedReadsEntry
        };
      }
      if (count > 1) {
        const totalWaste = tokens > 0 ? ` Toplam tekrar: ~${tokens * (count - 1)} token.` : "";
        return {
          additionalContext: `[Mindlore: ${input.basename} bu session'da ${count}. kez okunuyor.${totalWaste} Bir sonraki okuma engellenecek \u2014 Edit gerekiyorsa simdi yap.]`,
          updatedReadsEntry
        };
      }
      return { updatedReadsEntry };
    }
  }
});

// hooks/src/mindlore-read-guard.cjs
var fs = require("fs");
var path = require("path");
var { findMindloreDir, readHookStdin, getProjectName, hookLog, extractSkeleton, withTelemetrySync } = require("./lib/mindlore-common.cjs");
var { safeMkdir, safeWriteFile } = require("./lib/secure-io.cjs");
var { runReadGuard } = require_read_guard_core();
function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;
  const filePath = readHookStdin(["file_path", "path"]);
  if (!filePath) return;
  const cwd = process.cwd();
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(cwd)) return;
  if (resolved.startsWith(path.resolve(baseDir))) return;
  const diaryDir = path.join(baseDir, "diary");
  safeMkdir(diaryDir);
  const readsPath = path.join(diaryDir, `_session-reads-${getProjectName()}.json`);
  let reads = {};
  try {
    reads = JSON.parse(fs.readFileSync(readsPath, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") hookLog("read-guard", "warn", `read error: ${err.message}`);
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
    let skeletonSection = "";
    try {
      const ext = path.extname(filePath).slice(1);
      const fileContent = fs.readFileSync(filePath, "utf8");
      if (fileContent.length < 5e5) {
        const skeleton = extractSkeleton(fileContent, ext);
        if (skeleton !== fileContent) {
          const truncated = skeleton.length > 2e3 ? skeleton.slice(0, 2e3) + "\n...[truncated]" : skeleton;
          skeletonSection = "\n\n" + truncated;
        }
      }
    } catch (_e) {
    }
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: decision.additionalContext + skeletonSection
      }
    }));
  }
}
try {
  withTelemetrySync("mindlore-read-guard", main);
} catch (err) {
  hookLog("read-guard", "error", err?.message ?? String(err));
}
