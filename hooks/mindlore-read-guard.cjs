#!/usr/bin/env node
"use strict";

// hooks/src/mindlore-read-guard.cjs
var fs = require("fs");
var path = require("path");
var { findMindloreDir, readHookStdin, getProjectName, hookLog, extractSkeleton, withTelemetrySync } = require("./lib/mindlore-common.cjs");
var { safeMkdir, safeWriteFile } = require("./lib/secure-io.cjs");
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
  if (fs.existsSync(readsPath)) {
    try {
      reads = JSON.parse(fs.readFileSync(readsPath, "utf8"));
    } catch (_err) {
      reads = {};
    }
  }
  const normalizedPath = path.resolve(filePath);
  const existing = reads[normalizedPath];
  let count, tokens;
  if (typeof existing === "number") {
    count = existing + 1;
    tokens = 0;
    reads[normalizedPath] = { count, tokens: 0, chars: 0 };
  } else if (existing && typeof existing === "object") {
    count = (existing.count || 0) + 1;
    tokens = existing.tokens || 0;
    existing.count = count;
    reads[normalizedPath] = existing;
  } else {
    count = 1;
    tokens = 0;
    reads[normalizedPath] = { count, tokens: 0, chars: 0 };
  }
  safeWriteFile(readsPath, JSON.stringify(reads, null, 2));
  const basename = path.basename(filePath);
  const tokenInfo = tokens > 0 ? ` (~${tokens} token)` : "";
  if (count >= 3) {
    const totalWaste = tokens > 0 ? ` Toplam israf: ~${tokens * (count - 1)} token.` : "";
    process.stderr.write(`[Mindlore BLOCK] ${basename}${tokenInfo} bu session'da ${count}. kez okunuyor.${totalWaste} Edit icin gerekiyorsa once degisikligini yap, sonra tekrar oku. Analiz icin ctx_execute_file kullan.`);
    process.exit(2);
  }
  if (count > 1) {
    const totalWaste = tokens > 0 ? ` Toplam tekrar: ~${tokens * (count - 1)} token.` : "";
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
        additionalContext: `[Mindlore: ${basename}${tokenInfo} bu session'da ${count}. kez okunuyor.${totalWaste} Bir sonraki okuma engellenecek \u2014 Edit gerekiyorsa simdi yap.]${skeletonSection}`
      }
    }));
  }
}
try {
  withTelemetrySync("mindlore-read-guard", main);
} catch (err) {
  hookLog("read-guard", "error", err?.message ?? String(err));
}
