#!/usr/bin/env node
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// dist/scripts/lib/privacy-filter.js
var require_privacy_filter = __commonJS({
  "dist/scripts/lib/privacy-filter.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DEFAULT_PATTERNS = void 0;
    exports2.redactSecrets = redactSecrets;
    var REPLACEMENT = "[REDACTED]";
    var PATTERN_PREFIXES = [
      { prefix: "sk-", pattern: /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g },
      { prefix: "AKIA", pattern: /AKIA[0-9A-Z]{16}/g },
      { prefix: "ghp_", pattern: /ghp_[A-Za-z0-9]{36,}/g },
      { prefix: "gho_", pattern: /gho_[A-Za-z0-9]{36,}/g },
      { prefix: "github_pat_", pattern: /github_pat_[A-Za-z0-9_]{22,}/g },
      { prefix: "npm_", pattern: /npm_[A-Za-z0-9]{36,}/g },
      { prefix: "xox", pattern: /xox[bporas]-[A-Za-z0-9-]{10,}/g },
      { prefix: "eyJ", pattern: /eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}/g },
      { prefix: "AIza", pattern: /AIza[0-9A-Za-z_\-]{30,}/g },
      { prefix: "sk_live_", pattern: /sk_live_[a-zA-Z0-9]{20,}/g },
      { prefix: "pk_live_", pattern: /pk_live_[a-zA-Z0-9]{20,}/g },
      { prefix: "Bearer", pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g },
      { prefix: "-----BEGIN", pattern: /-----BEGIN\s(?:RSA\s|EC\s|DSA\s|OPENSSH\s)?PRIVATE\sKEY-----/g },
      { prefix: "Basic", pattern: /Basic\s+[a-zA-Z0-9+\/]{16,}={0,2}/g },
      { prefix: "-----BEGIN CERTIFICATE", pattern: /-----BEGIN\sCERTIFICATE-----/g }
    ];
    var NO_PREFIX_PATTERNS = [
      /(?:postgres|mysql|mongodb|redis|amqp)(?:\+srv)?:\/\/[^\s"']+/g,
      /(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|DB_PASSWORD|AUTH_TOKEN|ACCESS_KEY|SECRET_KEY)=\S+/gi,
      /(?:api_key|auth_token|access_token|refresh_token|client_secret|private_key|secret_key)\s*[:=]\s*["']?[^\s"',}{]{8,}["']?/gi
    ];
    exports2.DEFAULT_PATTERNS = [
      ...PATTERN_PREFIXES.map((p) => p.pattern),
      ...NO_PREFIX_PATTERNS
    ];
    function redactSecrets(text, extraPatterns) {
      let result = text;
      for (const { prefix, pattern } of PATTERN_PREFIXES) {
        if (result.includes(prefix)) {
          pattern.lastIndex = 0;
          result = result.replace(pattern, REPLACEMENT);
        }
      }
      const remaining = extraPatterns ? [...NO_PREFIX_PATTERNS, ...extraPatterns] : NO_PREFIX_PATTERNS;
      for (const pattern of remaining) {
        pattern.lastIndex = 0;
        result = result.replace(pattern, REPLACEMENT);
      }
      return result;
    }
  }
});

// hooks/src/mindlore-index.cjs
var fs = require("fs");
var path = require("path");
var { safeMkdir, safeWriteFile } = require("./lib/secure-io.cjs");
var { DB_NAME, SKIP_FILES, sha256, openDatabase, parseFrontmatter, extractFtsMetadata, insertFtsRow, readHookStdin, getProjectName, resolveProject, globalDir, hookLog, withTelemetry, isInsideMindloreDir, extractMindloreBaseDir } = require("./lib/mindlore-common.cjs");
function invalidateSearchCache(db) {
  try {
    db.exec("DELETE FROM search_cache");
  } catch (_) {
  }
}
function main() {
  const filePath = readHookStdin(["path", "file_path"]);
  if (!filePath) return;
  if (!filePath.endsWith(".md")) return;
  const resolvedFile = path.resolve(filePath);
  if (!isInsideMindloreDir(resolvedFile)) {
    const isCcMemory = resolvedFile.includes(path.sep + ".claude" + path.sep + "projects" + path.sep) && resolvedFile.includes(path.sep + "memory" + path.sep) && resolvedFile.endsWith(".md");
    if (!isCcMemory) return;
    indexCcMemory(resolvedFile);
    return;
  }
  const fileName = path.basename(filePath);
  const baseDir = extractMindloreBaseDir(resolvedFile);
  if (!baseDir) return;
  const dbPath = path.join(baseDir, DB_NAME);
  if (!fs.existsSync(dbPath)) return;
  if (["INDEX.md", "log.md"].includes(fileName)) {
    catchUpScan(baseDir, dbPath);
    return;
  }
  if (SKIP_FILES.has(fileName)) return;
  if (!fs.existsSync(filePath)) {
    const db2 = openDatabase(dbPath);
    if (!db2) return;
    try {
      db2.prepare("DELETE FROM mindlore_fts WHERE path = ?").run(filePath);
      db2.prepare("DELETE FROM file_hashes WHERE path = ?").run(filePath);
      invalidateSearchCache(db2);
    } finally {
      db2.close();
    }
    return;
  }
  const content = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const hash = sha256(content);
  const db = openDatabase(dbPath);
  if (!db) return;
  try {
    const existing = db.prepare("SELECT content_hash FROM file_hashes WHERE path = ?").get(filePath);
    if (existing && existing.content_hash === hash) return;
    const { meta, body } = parseFrontmatter(content);
    const { slug, description, type, category, title, tags, quality, dateCaptured, project: ftsProject } = extractFtsMetadata(meta, body, filePath, baseDir);
    const updateIndex = db.transaction(() => {
      db.prepare("DELETE FROM mindlore_fts WHERE path = ?").run(filePath);
      insertFtsRow(db, { path: filePath, slug, description, type, category, title, content: body, tags, quality, dateCaptured, project: resolveProject(ftsProject, filePath, getProjectName()) });
      db.prepare(
        `INSERT INTO file_hashes (path, content_hash, last_indexed)
         VALUES (?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           content_hash = excluded.content_hash,
           last_indexed = excluded.last_indexed`
      ).run(filePath, hash, (/* @__PURE__ */ new Date()).toISOString());
    });
    updateIndex();
    invalidateSearchCache(db);
  } finally {
    db.close();
  }
}
function indexCcMemory(filePath) {
  const CC_MEMORY_CATEGORY = "cc-memory";
  const globalBase = globalDir();
  const dbPath = path.join(globalBase, DB_NAME);
  const content = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  if (!content.trim()) return;
  let cleaned = content;
  try {
    const { redactSecrets } = require_privacy_filter();
    cleaned = redactSecrets(content);
  } catch (_err) {
  }
  const hash = sha256(cleaned);
  const db = openDatabase(dbPath);
  if (!db) return;
  try {
    const existing = db.prepare("SELECT content_hash FROM file_hashes WHERE path = ?").get(filePath);
    if (existing && existing.content_hash === hash) {
      return;
    }
    const { meta, body } = parseFrontmatter(cleaned);
    const memType = String(meta.type || "unknown");
    const projMatch = filePath.match(/projects[/\\]([^/\\]+)[/\\]memory/);
    const projectScope = projMatch ? projMatch[1] : null;
    const ftsData = extractFtsMetadata(meta, body, filePath, globalBase);
    const updateIndex = db.transaction(() => {
      db.prepare("DELETE FROM mindlore_fts WHERE path = ?").run(filePath);
      insertFtsRow(db, {
        path: filePath,
        ...ftsData,
        category: CC_MEMORY_CATEGORY,
        type: memType,
        project: projectScope
      });
      db.prepare(
        `INSERT INTO file_hashes (path, content_hash, last_indexed, source_type, project_scope)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           content_hash = excluded.content_hash,
           last_indexed = excluded.last_indexed,
           source_type = excluded.source_type,
           project_scope = excluded.project_scope`
      ).run(filePath, hash, (/* @__PURE__ */ new Date()).toISOString(), CC_MEMORY_CATEGORY, projectScope);
    });
    updateIndex();
    const memoryDir = path.join(globalBase, "memory", projectScope || "_global");
    safeMkdir(memoryDir);
    const destPath = path.join(memoryDir, path.basename(filePath));
    safeWriteFile(destPath, cleaned);
  } finally {
    db.close();
  }
}
function catchUpScan(baseDir, dbPath) {
  const CATCH_UP_DIRS = ["raw", "sources", "analyses", "diary"];
  const fiveMinAgo = Date.now() - 5 * 60 * 1e3;
  const db = openDatabase(dbPath);
  if (!db) return;
  try {
    let indexed = 0;
    for (const dir of CATCH_UP_DIRS) {
      const dirPath = path.join(baseDir, dir);
      if (!fs.existsSync(dirPath)) continue;
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < fiveMinAgo) continue;
        const content = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
        const hash = sha256(content);
        const existing = db.prepare("SELECT content_hash FROM file_hashes WHERE path = ?").get(filePath);
        if (existing && existing.content_hash === hash) continue;
        const { meta, body } = parseFrontmatter(content);
        const ftsData = extractFtsMetadata(meta, body, filePath, baseDir);
        const update = db.transaction(() => {
          db.prepare("DELETE FROM mindlore_fts WHERE path = ?").run(filePath);
          insertFtsRow(db, { path: filePath, ...ftsData, project: resolveProject(ftsData.project, filePath, getProjectName()) });
          db.prepare(
            `INSERT INTO file_hashes (path, content_hash, last_indexed)
             VALUES (?, ?, ?)
             ON CONFLICT(path) DO UPDATE SET
               content_hash = excluded.content_hash,
               last_indexed = excluded.last_indexed`
          ).run(filePath, hash, (/* @__PURE__ */ new Date()).toISOString());
        });
        update();
        indexed++;
      }
    }
    if (indexed > 0) {
      hookLog(`catch-up: ${indexed} file(s) indexed`);
    }
  } finally {
    db.close();
  }
}
withTelemetry("mindlore-index", main).catch((err) => {
  hookLog("mindlore-index", "error", err?.message ?? String(err));
  process.exit(0);
});
