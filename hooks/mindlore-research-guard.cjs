#!/usr/bin/env node
"use strict";

// hooks/src/mindlore-research-guard.cjs
var fs = require("fs");
var path = require("path");
var { getAllDbs, requireDatabase, extractKeywords, sanitizeKeyword, hookLog, withTelemetrySync } = require("./lib/mindlore-common.cjs");
var RESEARCH_SIGNALS = [
  "research",
  "ara\u015Ft\u0131r",
  "arastir",
  "investigate",
  "search for",
  "web search",
  "websearch",
  "webfetch",
  "fetch.*url",
  "look up",
  "find out",
  "check.*docs",
  "documentation.*for"
];
var RESEARCH_REGEX = new RegExp(RESEARCH_SIGNALS.join("|"), "i");
var EXCLUDE_REGEX = /\[mindlore:|\bmindlore-ingest\b|ingest.*url|save.*raw|\[research-override\]/i;
var MAX_AGE_DAYS = 30;
function isRecent(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const diff = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24);
  return diff <= MAX_AGE_DAYS;
}
function searchDbs(keywords) {
  const Database = requireDatabase();
  if (!Database) return [];
  const sanitized = keywords.map(sanitizeKeyword).filter(Boolean);
  if (sanitized.length === 0) return [];
  const matchQuery = sanitized.join(" OR ");
  const dbPaths = getAllDbs();
  const results = [];
  for (const dbPath of dbPaths) {
    try {
      const db = new Database(dbPath, { readonly: true });
      const rows = db.prepare(
        `SELECT path, slug, title, description, quality, date_captured, rank
         FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 10`
      ).all(matchQuery);
      for (const row of rows) {
        const quality = (row.quality || "medium").toLowerCase();
        const date_captured = row.date_captured || null;
        results.push({
          slug: row.slug || path.basename(row.path, ".md"),
          title: row.title || row.description || row.slug || "",
          quality,
          date_captured,
          recent: isRecent(date_captured),
          rank: row.rank
        });
      }
      db.close();
    } catch (_err) {
    }
  }
  results.sort((a, b) => a.rank - b.rank);
  return results.slice(0, 5);
}
function main() {
  let input;
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) return;
    input = JSON.parse(raw);
  } catch (_err) {
    return;
  }
  const toolName = input.tool_name || "";
  if (toolName !== "Agent") return;
  const toolInput = input.tool_input || {};
  const WEB_CAPABLE_TYPES = ["researcher", "general-purpose"];
  const LOCAL_ONLY_TYPES = [
    "Explore",
    "coder",
    "code-reviewer",
    "Plan",
    "bug-analyzer",
    "security-reviewer",
    "contrarian",
    "scope-guardian",
    "quality-gate",
    "test-runner"
  ];
  const subagentType = toolInput.subagent_type || "";
  const description = (toolInput.description || "").toLowerCase();
  if (LOCAL_ONLY_TYPES.includes(subagentType)) return;
  if (subagentType && !WEB_CAPABLE_TYPES.includes(subagentType)) return;
  if (!subagentType && !RESEARCH_REGEX.test(description)) return;
  const prompt = (toolInput.prompt || "") + " " + (toolInput.description || "");
  if (EXCLUDE_REGEX.test(prompt)) return;
  const isKnownResearchType = WEB_CAPABLE_TYPES.includes(subagentType);
  if (!isKnownResearchType && !RESEARCH_REGEX.test(prompt)) return;
  const keywords = extractKeywords(prompt, 10);
  if (keywords.length < 2) return;
  const matches = searchDbs(keywords);
  if (matches.length === 0) return;
  const lcKeywords = keywords.map((k) => k.toLowerCase());
  const relevantMatches = matches.filter((m) => {
    const haystack = `${m.slug} ${m.title}`.toLowerCase();
    const overlap = lcKeywords.filter((k) => haystack.includes(k));
    return overlap.length >= 2;
  });
  if (relevantMatches.length === 0) return;
  const strongMatches = relevantMatches.filter((m) => m.quality === "high" && m.recent);
  if (strongMatches.length > 0) {
    const slugList2 = strongMatches.map((m) => `  - ${m.slug} (${m.title})`).join("\n");
    const msg = `[mindlore-research-guard] BLOK: Bu konuda guncel, yuksek kaliteli bilgi DB'de zaten var.
Once mevcut bilgiyi oku:
${slugList2}
Eger bilgi yetersizse, prompt'a "[research-override]" ekleyerek tekrar dene.`;
    process.stderr.write(msg);
    process.exit(2);
  }
  const slugList = relevantMatches.map((m) => `${m.slug} (${m.quality}, ${m.date_captured || "tarih yok"})`).join(", ");
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: `[mindlore-research-guard] DB'de ilgili bilgi var ama eski/dusuk kalite: ${slugList}. Guncelleme gerekebilir \u2014 arastirma sonrasi DB'yi guncelle.`
    }
  };
  process.stdout.write(JSON.stringify(output));
}
try {
  withTelemetrySync("mindlore-research-guard", main);
} catch (err) {
  hookLog("research-guard", "error", err?.message ?? String(err));
}
