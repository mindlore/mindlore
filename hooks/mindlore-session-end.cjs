#!/usr/bin/env node
"use strict";

// hooks/src/mindlore-session-end.cjs
var fs = require("fs");
var path = require("path");
var os = require("os");
var { execFileSync, spawn } = require("child_process");
var { safeWriteFile, safeWriteJson } = require("./lib/secure-io.cjs");
var { findMindloreDir, globalDir, getProjectName, openDatabase, ensureEpisodesTable, hasEpisodesTable, insertBareEpisode, insertFtsRow, hookLog, SHARED_EXPORT_DIRS, resolveWin32Bin, withTelemetry, getUnpromotedRawFiles, cleanupExpiredInjectLog } = require("./lib/mindlore-common.cjs");
var EXPORT_DIRS = SHARED_EXPORT_DIRS;
if (process.argv.includes("--worker")) {
  hookLog("session-end", "info", "worker started, pid=" + process.pid);
  const dataPath = process.argv[process.argv.indexOf("--worker") + 1];
  let payload;
  try {
    const raw = fs.readFileSync(dataPath, "utf8");
    fs.unlinkSync(dataPath);
    payload = JSON.parse(raw);
  } catch (_err) {
    hookLog("session-end", "error", "payload read failed: " + (_err?.message ?? _err));
    process.exit(0);
  }
  const { baseDir, project, commits, changedFiles, reads } = payload;
  async function safeRunAsync(fn, label) {
    try {
      await fn();
      hookLog("session-end", "info", label + " OK");
    } catch (e) {
      hookLog("session-end", "error", label + " FAIL: " + e?.message);
    }
  }
  (async () => {
    await safeRunAsync(() => writeBareEpisode(baseDir, project, commits, changedFiles, reads), "episode");
    await safeRunAsync(() => writeEpisodeFile(baseDir, project, commits, changedFiles, reads), "episode-file");
    const nodeExe = resolveWin32Bin("node") || process.execPath;
    function runSyncScript(scriptName, args, timeoutMs, label) {
      const cjsName = scriptName.replace(/\.js$/, ".cjs");
      const scriptPath = [path.join(__dirname, cjsName), path.join(__dirname, "..", "dist", "scripts", scriptName)].find((p) => fs.existsSync(p));
      if (!scriptPath) return;
      try {
        execFileSync(nodeExe, [scriptPath, ...args], {
          timeout: timeoutMs,
          env: { ...process.env, MINDLORE_HOME: baseDir },
          windowsHide: true
        });
        hookLog("session-end", "info", label + " completed");
      } catch (err) {
        hookLog("session-end", "warn", `${label} failed: ${err?.message || err}`);
      }
    }
    await safeRunAsync(() => runSyncScript("cc-memory-bulk-sync.js", ["--auto"], 1e4, "CC memory sync"), "cc-memory-sync");
    await safeRunAsync(() => runSyncScript("cc-session-sync.js", [], 3e4, "CC session sync"), "cc-session-sync");
    await safeRunAsync(() => {
      const unpromoted = getUnpromotedRawFiles(baseDir);
      if (unpromoted.length >= 5) {
        hookLog("session-end", "info", `${unpromoted.length} raw files unpromoted`);
      }
    }, "raw-check");
    await Promise.allSettled([
      safeRunAsync(() => syncObsidian(baseDir), "obsidian"),
      safeRunAsync(() => syncGlobalRepo(), "git-sync")
    ]);
    hookLog("session-end", "info", "worker done");
    process.exit(0);
  })();
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}-${h}${min}`;
}
function getRecentGitInfo() {
  try {
    const raw = execFileSync("git", ["log", "--oneline", "-5", "--name-only"], {
      encoding: "utf8",
      timeout: 5e3,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    }).trim();
    if (!raw) return { commits: [], changedFiles: [] };
    const commits = [];
    const fileSet = /* @__PURE__ */ new Set();
    for (const line of raw.split("\n")) {
      if (!line) continue;
      if (/^[0-9a-f]{7,}\s/.test(line)) {
        commits.push(line);
      } else {
        fileSet.add(line);
      }
    }
    return { commits, changedFiles: [...fileSet].slice(0, 20) };
  } catch (_err) {
    return { commits: [], changedFiles: [] };
  }
}
function getSessionReads(baseDir) {
  const readsPath = path.join(baseDir, "diary", `_session-reads-${getProjectName()}.json`);
  if (!fs.existsSync(readsPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(readsPath, "utf8"));
    const count = Object.keys(data).length;
    const repeats = Object.values(data).filter((v) => {
      if (typeof v === "number") return v > 1;
      if (v && typeof v === "object") return (v.count || 0) > 1;
      return false;
    }).length;
    fs.unlinkSync(readsPath);
    return { count, repeats };
  } catch (_err) {
    return null;
  }
}
function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;
  const diaryDir = path.join(baseDir, "diary");
  if (!fs.existsSync(diaryDir)) {
    fs.mkdirSync(diaryDir, { recursive: true });
  }
  const now = /* @__PURE__ */ new Date();
  const dateStr = formatDate(now);
  const deltaPath = path.join(diaryDir, `delta-${dateStr}.md`);
  if (fs.existsSync(deltaPath)) return;
  const { commits, changedFiles } = getRecentGitInfo();
  const reads = getSessionReads(baseDir);
  const project = getProjectName();
  const sections = [
    "---",
    `slug: delta-${dateStr}`,
    "type: diary",
    `date: ${now.toISOString().slice(0, 10)}`,
    `project: ${project}`,
    "---",
    "",
    `# Session Delta \u2014 ${dateStr}`,
    "",
    `Session ended: ${now.toISOString()}`
  ];
  sections.push("", "## Commits");
  if (commits.length > 0) {
    for (const c of commits) sections.push(`- ${c}`);
  } else {
    sections.push("- _(no commits)_");
  }
  sections.push("", "## Changed Files");
  if (changedFiles.length > 0) {
    for (const f of changedFiles) sections.push(`- ${f}`);
  } else {
    sections.push("- _(no file changes)_");
  }
  if (reads) {
    sections.push("", "## Read Stats");
    sections.push(`- ${reads.count} files read, ${reads.repeats} repeated reads`);
  }
  sections.push("");
  safeWriteFile(deltaPath, sections.join("\n"));
  const logPath = path.join(baseDir, "log.md");
  if (fs.existsSync(logPath)) {
    const logEntry = `| ${now.toISOString().slice(0, 10)} | session-end | delta-${dateStr}.md |
`;
    fs.appendFileSync(logPath, logEntry, "utf8");
  }
  try {
    const workerData = JSON.stringify({ baseDir, project, commits, changedFiles, reads });
    const tmpFile = path.join(os.tmpdir(), `mindlore-worker-${Date.now()}.json`);
    safeWriteFile(tmpFile, workerData);
    const nodeBin = resolveWin32Bin("node");
    const child = spawn(nodeBin, [__filename, "--worker", tmpFile], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
      windowsHide: true
    });
    child.unref();
  } catch (_err) {
    writeBareEpisode(baseDir, project, commits, changedFiles, reads);
    writeEpisodeFile(baseDir, project, commits, changedFiles, reads);
    syncObsidian(baseDir);
    syncGlobalRepo();
  }
}
function writeBareEpisode(baseDir, project, commits, changedFiles, reads) {
  try {
    const dbPath = path.join(baseDir, "mindlore.db");
    const db = openDatabase(dbPath);
    if (!db) return;
    if (!hasEpisodesTable(db)) {
      ensureEpisodesTable(db);
    }
    const commitList = commits.length > 0 ? commits.join(", ") : "no commits";
    const fileCount = changedFiles.length;
    const summary = `Session: ${commitList} (${fileCount} files)`;
    const bodyParts = [];
    if (commits.length > 0) {
      bodyParts.push("## Commits\n" + commits.map((c) => `- ${c}`).join("\n"));
    }
    if (changedFiles.length > 0) {
      bodyParts.push("## Changed Files\n" + changedFiles.map((f) => `- ${f}`).join("\n"));
    }
    if (reads) {
      bodyParts.push(`## Read Stats
- ${reads.count} files read, ${reads.repeats} repeated`);
    }
    const entities = changedFiles.slice(0, 10);
    const body = bodyParts.join("\n\n") || null;
    const truncatedSummary = summary.slice(0, 300);
    const writeBoth = db.transaction(() => {
      const epId = insertBareEpisode(db, {
        kind: "session",
        scope: "project",
        project,
        summary: truncatedSummary,
        body,
        tags: "session",
        entities: entities.length > 0 ? entities : null,
        source: "hook"
      });
      try {
        insertFtsRow(db, {
          path: `episodes/${epId}`,
          slug: `ep-${epId}`,
          description: truncatedSummary,
          type: "episode",
          category: "episodes",
          title: truncatedSummary,
          content: [truncatedSummary, body ?? ""].join("\n").trim(),
          tags: "session",
          quality: null,
          dateCaptured: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
          project
        });
      } catch (_ftsErr) {
      }
    });
    writeBoth();
    try {
      cleanupExpiredInjectLog(db);
    } catch (_err) {
    }
    db.close();
  } catch (err) {
    hookLog("session-end", "error", `episode write failed: ${err?.message ?? err}`);
  }
}
function writeEpisodeFile(baseDir, project, commits, changedFiles, reads) {
  const projDir = path.join(baseDir, "diary", project || "unknown");
  if (!fs.existsSync(projDir)) fs.mkdirSync(projDir, { recursive: true });
  const now = process.env.MINDLORE_EPISODE_TS ? new Date(process.env.MINDLORE_EPISODE_TS) : /* @__PURE__ */ new Date();
  const ts = formatDate(now);
  const filePath = path.join(projDir, `episode-${ts}.md`);
  if (fs.existsSync(filePath)) return;
  const lines = [
    "---",
    `slug: episode-${ts}`,
    "type: episode",
    `date: ${now.toISOString().slice(0, 10)}`,
    `project: ${project || "unknown"}`,
    "---",
    "",
    `# Episode \u2014 ${ts}`,
    ""
  ];
  if (commits.length > 0) {
    lines.push("## Commits");
    for (const c of commits) lines.push(`- ${c}`);
    lines.push("");
  }
  if (changedFiles.length > 0) {
    lines.push("## Changed Files");
    for (const f of changedFiles) lines.push(`- ${f}`);
    lines.push("");
  }
  if (reads) {
    lines.push("## Read Stats");
    lines.push(`- ${reads.count} files read, ${reads.repeats} repeated`);
    lines.push("");
  }
  if (commits.length === 0 && changedFiles.length === 0) {
    lines.push("_Read-only session \u2014 no commits or file changes._");
    lines.push("");
  }
  safeWriteFile(filePath, lines.join("\n"));
}
var _obsidianHelpersCache = void 0;
function getObsidianHelpers() {
  if (_obsidianHelpersCache !== void 0) return _obsidianHelpersCache;
  try {
    const hookDir = __dirname;
    const pkgRoot = path.dirname(hookDir);
    const helpersPath = path.join(pkgRoot, "dist", "scripts", "lib", "obsidian-helpers.js");
    _obsidianHelpersCache = require(helpersPath);
    return _obsidianHelpersCache;
  } catch (err) {
    if (process.env.MINDLORE_DEBUG === "1") {
      process.stderr.write(`[mindlore] obsidian-helpers not available: ${err.message}
`);
    }
    _obsidianHelpersCache = null;
    return null;
  }
}
function exportMdFile(srcPath, destPath, convertFn) {
  try {
    const destStat = fs.statSync(destPath);
    const srcStat = fs.statSync(srcPath);
    if (srcStat.mtimeMs <= destStat.mtimeMs) return false;
  } catch (_err) {
  }
  let content = fs.readFileSync(srcPath, "utf8");
  content = convertFn(content);
  fs.writeFileSync(destPath, content, "utf8");
  return true;
}
function syncObsidian(baseDir) {
  try {
    let walkAndExport = function(srcDir, destDir) {
      if (!fs.existsSync(srcDir)) return;
      fs.mkdirSync(destDir, { recursive: true });
      for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
          walkAndExport(srcPath, destPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          if (exportMdFile(srcPath, destPath, convertFn)) exported++;
        }
      }
    };
    const configPath = path.join(baseDir, "config.json");
    if (!fs.existsSync(configPath)) return;
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const vaultPath = config?.obsidian?.vault;
    if (!vaultPath || typeof vaultPath !== "string") return;
    if (!fs.existsSync(vaultPath)) return;
    const helpers = getObsidianHelpers();
    const convertFn = helpers?.convertToWikilinks ?? ((c) => c.replace(/\[([^\]]+)\]\((?:\.\.?\/)?(?:[\w-]+\/)*([^/)]+)\.md\)/g, "[[$2]]"));
    const destBase = path.join(vaultPath, "mindlore");
    let exported = 0;
    for (const dir of EXPORT_DIRS) {
      walkAndExport(path.join(baseDir, dir), path.join(destBase, dir));
    }
    for (const rootFile of ["INDEX.md", "log.md"]) {
      const srcPath = path.join(baseDir, rootFile);
      if (!fs.existsSync(srcPath)) continue;
      fs.mkdirSync(destBase, { recursive: true });
      if (exportMdFile(srcPath, path.join(destBase, rootFile), convertFn)) exported++;
    }
    hookLog("session-end", "info", `obsidian exported=${exported}, dirs=${EXPORT_DIRS.length}, vault=${vaultPath}`);
    if (exported > 0) {
      config.obsidian.lastExport = (/* @__PURE__ */ new Date()).toISOString();
      config.obsidian.lastExportCount = exported;
      safeWriteJson(configPath, config);
    }
  } catch (err) {
    hookLog("session-end", "error", `obsidian internal: ${err?.message ?? err}`);
    throw err;
  }
}
function resolveGitBin() {
  return resolveWin32Bin("git");
}
function syncGlobalRepo() {
  const gDir = globalDir();
  const gitDir = path.join(gDir, ".git");
  if (!fs.existsSync(gitDir)) return;
  const git = resolveGitBin();
  const execOpts = (timeout) => ({ cwd: gDir, encoding: "utf8", timeout, stdio: "pipe", windowsHide: true });
  const status = execFileSync(git, ["status", "--porcelain"], execOpts(5e3)).trim();
  if (!status) return;
  execFileSync(git, ["add", "*.md", "mindlore.db", "diary/", "sources/", "domains/", "analyses/", "decisions/", "raw/", "connections/", "insights/", "learnings/"], execOpts(1e4));
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19);
  execFileSync(git, ["commit", "-m", `mindlore auto-sync ${now}`], execOpts(15e3));
  try {
    execFileSync(git, ["push"], execOpts(3e4));
  } catch (_pushErr) {
    hookLog("session-end", "warn", "git push failed (offline?): " + (_pushErr?.message ?? "").slice(0, 100));
  }
}
if (!process.argv.includes("--worker")) {
  withTelemetry("mindlore-session-end", main).catch((err) => {
    hookLog("mindlore-session-end", "error", err?.message ?? String(err));
    process.exit(0);
  });
}
