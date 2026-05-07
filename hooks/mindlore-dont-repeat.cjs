#!/usr/bin/env node
"use strict";

// hooks/src/mindlore-dont-repeat.cjs
var fs = require("fs");
var path = require("path");
var os = require("os");
var { findMindloreDir, getProjectName, hookLog, withTelemetrySync } = require("./lib/mindlore-common.cjs");
var cacheDirty = false;
function readCache(cachePath) {
  if (!cachePath) return {};
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch (_err) {
    return {};
  }
}
function writeCache(cachePath, cache) {
  if (!cachePath || !cacheDirty) return;
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache), "utf8");
  } catch (_err) {
  }
}
function loadPatterns(filePath, cache) {
  try {
    const stat = fs.statSync(filePath);
    const mtimeMs = stat.mtimeMs;
    const cached = cache[filePath];
    if (cached && cached.mtimeMs === mtimeMs) return cached.patterns;
    const patterns = extractNegativePatterns(fs.readFileSync(filePath, "utf8"));
    cache[filePath] = { mtimeMs, patterns };
    cacheDirty = true;
    return patterns;
  } catch (_err) {
    return [];
  }
}
function extractNegativePatterns(content) {
  const patterns = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const isNegativeRule = /^-\s*(YAPMA|KRITIK|DON'?T|NEVER|AVOID|DO NOT):/i.test(trimmed);
    if (!isNegativeRule) continue;
    const backtickMatches = trimmed.match(/`([^`]+)`/g);
    if (backtickMatches) {
      for (const match of backtickMatches) {
        const pattern = match.slice(1, -1).trim();
        if (pattern.length < 8) continue;
        if (/^[^a-zA-Z0-9]+$/.test(pattern)) continue;
        if (/^\w+$/.test(pattern) && pattern.length < 12) continue;
        if (/^\.\w{1,5}$/.test(pattern)) continue;
        if (pattern.startsWith("/") || pattern.startsWith("~")) continue;
        if (pattern.includes(".md") || pattern.includes(".json")) continue;
        if (/^(node|bash|npm|git|process|require|import|export|const|let|var)$/i.test(pattern)) continue;
        patterns.push({
          pattern,
          rule: trimmed.substring(0, 120)
        });
      }
    }
    const quoteMatches = trimmed.match(/"([^"]+)"/g);
    if (quoteMatches) {
      for (const match of quoteMatches) {
        const quoted = match.slice(1, -1).trim();
        if (quoted.length < 4) continue;
        patterns.push({
          pattern: quoted,
          rule: trimmed.substring(0, 120)
        });
      }
    }
  }
  return patterns;
}
function checkContent(content, patterns) {
  const matches = [];
  for (const p of patterns) {
    try {
      const escaped = p.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      if (regex.test(content)) {
        matches.push(p);
      }
    } catch {
    }
  }
  return matches;
}
function main() {
  let input = "";
  const stdinTimeout = setTimeout(() => process.exit(0), 3e3);
  process.stdin.setEncoding("utf8");
  process.stdin.on("error", () => process.exit(0));
  process.stdin.on("data", (chunk) => input += chunk);
  process.stdin.on("end", () => {
    clearTimeout(stdinTimeout);
    try {
      const data = JSON.parse(input || "{}");
      const toolName = data.tool_name || "";
      if (!["Write", "Edit"].includes(toolName)) {
        return process.exit(0);
      }
      const toolInput = data.tool_input || {};
      const filePath = toolInput.file_path || "";
      if (!filePath) return process.exit(0);
      const ext = path.extname(filePath).toLowerCase();
      const codeExts = [".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".sh", ".yaml", ".yml"];
      if (!codeExts.includes(ext)) return process.exit(0);
      const basename = path.basename(filePath);
      if (basename === "LESSONS.md" || basename === "global.md" || basename === "CLAUDE.md") {
        return process.exit(0);
      }
      const allContent = [
        toolInput.content || "",
        toolInput.new_string || ""
      ].join("\n");
      if (allContent.trim().length < 10) return process.exit(0);
      const mindloreDir = findMindloreDir();
      const cachePath = mindloreDir ? path.join(mindloreDir, "diary", `_pattern-cache-${getProjectName()}.json`) : null;
      const cache = readCache(cachePath);
      const allPatterns = [];
      const cwd = process.cwd();
      allPatterns.push(...loadPatterns(path.join(os.homedir(), ".claude", "lessons", "global.md"), cache));
      allPatterns.push(...loadPatterns(path.join(cwd, "LESSONS.md"), cache));
      if (mindloreDir) {
        const learningsDir = path.join(mindloreDir, "learnings");
        try {
          const files = fs.readdirSync(learningsDir).filter((f) => f.endsWith(".md"));
          for (const file of files) {
            allPatterns.push(...loadPatterns(path.join(learningsDir, file), cache));
          }
        } catch (_err) {
        }
      }
      writeCache(cachePath, cache);
      if (allPatterns.length === 0) return process.exit(0);
      const matches = checkContent(allContent, allPatterns);
      if (matches.length === 0) return process.exit(0);
      const shown = matches.slice(0, 3);
      const warning = shown.map(
        (m) => `  - Pattern: \`${m.pattern}\` \u2192 ${m.rule}`
      ).join("\n");
      const extra = matches.length > 3 ? `
  ... and ${matches.length - 3} more` : "";
      const msg = `[Mindlore: ${matches.length} dont-repeat rule violation detected]
${warning}${extra}`;
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: msg
        }
      }));
    } catch {
    }
    process.exit(0);
  });
}
try {
  withTelemetrySync("mindlore-dont-repeat", main);
} catch (err) {
  hookLog("dont-repeat", "error", err?.message ?? String(err));
}
