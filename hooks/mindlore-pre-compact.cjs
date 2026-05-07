#!/usr/bin/env node
"use strict";

// hooks/src/mindlore-pre-compact.cjs
var fs = require("fs");
var path = require("path");
var { findMindloreDir, openDatabase, hookLog, withTelemetry, listSnapshots } = require("./lib/mindlore-common.cjs");
function collectRecentEpisodes(baseDir) {
  try {
    const dbPath = path.join(baseDir, "mindlore.db");
    const db = openDatabase(dbPath, { readonly: true });
    if (!db) return [];
    try {
      const episodes = db.prepare(
        "SELECT kind, summary FROM episodes WHERE created_at > datetime('now', '-4 hours') ORDER BY created_at DESC LIMIT 20"
      ).all();
      if (episodes.length === 0) return [];
      const grouped = {};
      for (const ep of episodes) {
        const kind = ep.kind || "other";
        if (!grouped[kind]) grouped[kind] = [];
        grouped[kind].push(ep.summary);
      }
      const lines = ["## Session Episodes"];
      for (const [kind, items] of Object.entries(grouped)) {
        lines.push(`### ${kind}`);
        for (const item of items) lines.push(`- ${item}`);
      }
      return lines;
    } finally {
      db.close();
    }
  } catch (_err) {
    return [];
  }
}
function collectGitDiff() {
  try {
    const { execFileSync } = require("child_process");
    let diffStat = "";
    try {
      diffStat = execFileSync("git", ["diff", "--stat", "HEAD"], { encoding: "utf8", timeout: 5e3, stdio: ["pipe", "pipe", "pipe"] }).trim();
    } catch {
      diffStat = "";
    }
    if (diffStat) return ["## Changed Files (uncommitted)", "```", diffStat, "```"];
    return [];
  } catch (_err) {
    return [];
  }
}
function getActivePlan() {
  try {
    const plansDir = path.join(process.cwd(), ".claude", "plans");
    if (!fs.existsSync(plansDir)) return [];
    const plans = fs.readdirSync(plansDir).filter((f) => f.endsWith(".md"));
    if (plans.length === 0) return [];
    const latestPlan = plans.sort().pop();
    return [`## Active Plan: ${latestPlan}`];
  } catch (_err) {
    return [];
  }
}
function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;
  const indexScript = path.join(__dirname, "..", "scripts", "mindlore-fts5-index.cjs");
  if (fs.existsSync(indexScript)) {
    try {
      const { spawnSync } = require("child_process");
      spawnSync("node", [indexScript, baseDir], {
        timeout: 1e4,
        stdio: "pipe",
        windowsHide: true
      });
    } catch (_err) {
    }
  }
  const now = /* @__PURE__ */ new Date();
  const iso = now.toISOString();
  const ts = iso.replace(/[:.]/g, "-");
  const episodesDir = path.join(baseDir, "episodes");
  try {
    const episodePath = path.join(episodesDir, `pre-compact-${ts}.md`);
    const content = [
      "---",
      "type: episode",
      "subtype: pre-compact",
      `date: ${iso.slice(0, 10)}`,
      `project: ${path.basename(process.cwd())}`,
      "---",
      "",
      `Pre-compact snapshot at ${iso}.`,
      `Working directory: ${process.cwd()}`
    ].join("\n");
    fs.writeFileSync(episodePath, content, "utf8");
  } catch (_err) {
  }
  const logPath = path.join(baseDir, "log.md");
  try {
    const entry = `| ${iso.slice(0, 10)} | pre-compact | FTS5 flush before compaction |
`;
    fs.appendFileSync(logPath, entry, "utf8");
  } catch (_err) {
  }
  const diaryDir = path.join(baseDir, "diary");
  try {
    const sections = [];
    sections.push(...collectRecentEpisodes(baseDir));
    sections.push(...collectGitDiff());
    sections.push(...getActivePlan());
    if (sections.length > 0) {
      const snapshotContent = [
        "---",
        "type: compaction-snapshot",
        `date: ${iso.slice(0, 10)}`,
        `project: ${path.basename(process.cwd())}`,
        "---",
        "",
        ...sections
      ].join("\n");
      fs.writeFileSync(path.join(diaryDir, `compaction-snapshot-${ts}.md`), snapshotContent);
    }
    const snapshots = listSnapshots(diaryDir).filter((f) => f.startsWith("compaction-"));
    while (snapshots.length > 5) {
      const oldest = snapshots.shift();
      if (oldest) fs.unlinkSync(path.join(diaryDir, oldest));
    }
  } catch (_err) {
  }
  process.stdout.write("[Mindlore: pre-compact FTS5 flush complete]\n");
}
withTelemetry("mindlore-pre-compact", main).catch((err) => {
  hookLog("mindlore-pre-compact", "error", err?.message ?? String(err));
  process.exit(0);
});
