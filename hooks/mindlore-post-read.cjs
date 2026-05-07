#!/usr/bin/env node
"use strict";

// hooks/src/mindlore-post-read.cjs
var fs = require("fs");
var path = require("path");
var { findMindloreDir, getProjectName, hookLog, withTelemetry } = require("./lib/mindlore-common.cjs");
var CODE_EXTS = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".css", ".scss", ".sql", ".sh", ".yaml", ".yml", ".json", ".toml", ".xml", ".cjs", ".mjs"]);
var PROSE_EXTS = /* @__PURE__ */ new Set([".md", ".txt", ".rst", ".adoc"]);
function estimateTokens(charCount, ext) {
  const ratio = CODE_EXTS.has(ext) ? 3.5 : PROSE_EXTS.has(ext) ? 4 : 3.75;
  return Math.ceil(charCount / ratio);
}
function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;
  let input = "";
  const stdinTimeout = setTimeout(() => process.exit(0), 3e3);
  process.stdin.setEncoding("utf8");
  process.stdin.on("error", () => process.exit(0));
  process.stdin.on("data", (chunk) => input += chunk);
  process.stdin.on("end", () => {
    clearTimeout(stdinTimeout);
    try {
      const data = JSON.parse(input || "{}");
      const toolInput = data.tool_input || {};
      const toolOutput = data.tool_output || {};
      const filePath = toolInput.file_path || toolInput.path || "";
      if (!filePath) return process.exit(0);
      const resolved = path.resolve(filePath);
      if (resolved.startsWith(path.resolve(baseDir))) return process.exit(0);
      let charCount = 0;
      if (toolOutput.content) {
        charCount = typeof toolOutput.content === "string" ? toolOutput.content.length : JSON.stringify(toolOutput.content).length;
      } else {
        try {
          const stat = fs.statSync(resolved);
          charCount = stat.size;
        } catch {
          return process.exit(0);
        }
      }
      if (charCount === 0) return process.exit(0);
      const ext = path.extname(filePath).toLowerCase();
      const tokens = estimateTokens(charCount, ext);
      const diaryDir = path.join(baseDir, "diary");
      const readsPath = path.join(diaryDir, `_session-reads-${getProjectName()}.json`);
      let reads = {};
      if (fs.existsSync(readsPath)) {
        try {
          reads = JSON.parse(fs.readFileSync(readsPath, "utf8"));
        } catch {
          reads = {};
        }
      }
      const normalizedPath = path.resolve(filePath);
      const key = normalizedPath;
      if (typeof reads[key] === "number") {
        reads[key] = { count: reads[key], tokens, chars: charCount };
      } else if (reads[key] && typeof reads[key] === "object") {
        reads[key].tokens = tokens;
        reads[key].chars = charCount;
      } else {
        reads[key] = { count: 1, tokens, chars: charCount };
      }
      fs.writeFileSync(readsPath, JSON.stringify(reads, null, 2), "utf8");
      const basename = path.basename(filePath);
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: `[Mindlore: ${basename} \u2014 ~${tokens} token (${charCount} char). Edit etmeyeceksen ctx_execute_file kullan.]`
        }
      }));
    } catch {
    }
    process.exit(0);
  });
}
withTelemetry("mindlore-post-read", main).catch((err) => {
  hookLog("post-read", "error", err?.message ?? String(err));
});
