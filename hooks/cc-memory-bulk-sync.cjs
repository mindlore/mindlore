#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// dist/scripts/lib/constants.js
var require_constants = __commonJS({
  "dist/scripts/lib/constants.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.CONSOLIDATION_THRESHOLD = exports2.STALE_THRESHOLD = exports2.DECAY_HALF_LIFE_DAYS = exports2.DEFAULT_TOKEN_BUDGET = exports2.CC_MEMORY_BOOST = exports2.CC_SUBAGENT_CATEGORY = exports2.CC_SESSION_CATEGORY = exports2.CC_MEMORY_CATEGORY = exports2.CC_MEMORY_DIR = exports2.CC_MEMORY_PATH_MARKER = exports2.TYPE_TO_DIR = exports2.RELATED_OVERFETCH = exports2.MAX_RELATED_SOURCES = exports2.RELATION_PRIORITY = exports2.SYMMETRIC_TYPES = exports2.RELATION_TYPES = exports2.QUALITY_HEURISTICS = exports2.QUALITY_VALUES = exports2.FRONTMATTER_TYPES = exports2.FTS5_COLUMNS = exports2.STOP_WORDS = exports2.TURKISH_WORD_RE = exports2.STOP_WORDS_MIN_LENGTH = exports2.SESSION_CATEGORIES = exports2.CATEGORIES = exports2.SCHEMA_VERSION = exports2.DEFAULT_MODELS = exports2.CONFIG_FILE = exports2.MCP_BUSY_TIMEOUT_MS = exports2.DB_BUSY_TIMEOUT_MS = exports2.SKIP_FILES = exports2.DIRECTORIES = exports2.DB_NAME = exports2.GLOBAL_MINDLORE_DIR = exports2.MINDLORE_DIR = exports2.KNOWN_HOOK_EVENTS = void 0;
    exports2.isKnownHookEvent = isKnownHookEvent;
    exports2.isSessionCategory = isSessionCategory;
    exports2.fixVersionTokens = fixVersionTokens;
    exports2.buildPriorityCase = buildPriorityCase;
    exports2.homedir = homedir;
    exports2.getActiveMindloreDir = getActiveMindloreDir;
    exports2.getAllDbs = getAllDbs;
    exports2.getProjectName = getProjectName;
    exports2.log = log;
    exports2.isContentFile = isContentFile;
    exports2.resolveHookCommon = resolveHookCommon;
    exports2.hasYoutubeTranscript = hasYoutubeTranscript;
    var os_12 = __importDefault2(require("os"));
    var fs_12 = __importDefault2(require("fs"));
    var path_12 = __importDefault2(require("path"));
    exports2.KNOWN_HOOK_EVENTS = [
      "SessionStart",
      "SessionEnd",
      "UserPromptSubmit",
      "FileChanged",
      "PreToolUse",
      "PostToolUse",
      "PreCompact",
      "PostCompact",
      "CwdChanged"
    ];
    function isKnownHookEvent(s) {
      return exports2.KNOWN_HOOK_EVENTS.includes(s);
    }
    exports2.MINDLORE_DIR = ".mindlore";
    exports2.GLOBAL_MINDLORE_DIR = process.env.MINDLORE_HOME ?? path_12.default.join(os_12.default.homedir(), exports2.MINDLORE_DIR);
    exports2.DB_NAME = "mindlore.db";
    exports2.DIRECTORIES = [
      "raw",
      "sources",
      "domains",
      "analyses",
      "insights",
      "connections",
      "learnings",
      "diary",
      "decisions",
      "logs",
      "memory"
    ];
    exports2.SKIP_FILES = /* @__PURE__ */ new Set(["INDEX.md", "SCHEMA.md", "log.md"]);
    exports2.DB_BUSY_TIMEOUT_MS = 2e3;
    exports2.MCP_BUSY_TIMEOUT_MS = 5e3;
    exports2.CONFIG_FILE = "config.json";
    exports2.DEFAULT_MODELS = {
      ingest: "haiku",
      evolve: "sonnet",
      explore: "sonnet",
      default: "haiku"
    };
    exports2.SCHEMA_VERSION = 1;
    exports2.CATEGORIES = ["sources", "analyses", "domains", "episodes", "decisions", "raw", "sessions", "cc_memory", "cc-session", "cc-subagent", "diary", "insights", "connections", "learnings", "memory"];
    exports2.SESSION_CATEGORIES = ["cc-subagent", "cc-session"];
    function isSessionCategory(category) {
      return exports2.SESSION_CATEGORIES.includes(category);
    }
    exports2.STOP_WORDS_MIN_LENGTH = 2;
    exports2.TURKISH_WORD_RE = /[^\w\sçğıöşüÇĞİÖŞÜ-]/g;
    exports2.STOP_WORDS = /* @__PURE__ */ new Set([
      // English
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "shall",
      "to",
      "of",
      "in",
      "for",
      "on",
      "with",
      "at",
      "by",
      "from",
      "as",
      "into",
      "through",
      "during",
      "it",
      "its",
      "this",
      "that",
      "these",
      "those",
      "what",
      "which",
      "who",
      "whom",
      "how",
      "when",
      "where",
      "why",
      "not",
      "no",
      "nor",
      "so",
      "if",
      "or",
      "but",
      "all",
      "each",
      "every",
      "both",
      "few",
      "more",
      "most",
      "other",
      "some",
      "such",
      "only",
      "own",
      "same",
      "than",
      "and",
      "about",
      "between",
      "after",
      "before",
      "above",
      "below",
      "up",
      "down",
      "out",
      "very",
      "just",
      "also",
      "now",
      "then",
      "here",
      "there",
      "too",
      "yet",
      "my",
      "your",
      "his",
      "her",
      "our",
      "their",
      "me",
      "him",
      "us",
      "them",
      "i",
      "you",
      "he",
      "she",
      "we",
      "they",
      // Turkish
      "bir",
      "bu",
      "su",
      "ne",
      "nas\u0131l",
      "neden",
      "var",
      "yok",
      "mi",
      "mu",
      "m\u0131",
      "ile",
      "i\xE7in",
      "de",
      "da",
      "ve",
      "veya",
      "ama",
      "ise",
      "hem",
      "bakal\u0131m",
      "gel",
      "git",
      "yap",
      "et",
      "al",
      "ver",
      "evet",
      "hay\u0131r",
      "tamam",
      "ok",
      "oldu",
      "olur",
      "dur",
      "\u015Fimdi",
      "sonra",
      "\xF6nce",
      "hemen",
      "biraz",
      "lan",
      "ya",
      "ki",
      "abi",
      "hadi",
      "hey",
      "selam",
      "olarak",
      "olan",
      "gibi",
      "kadar",
      "daha",
      "\xE7ok",
      "en",
      "bunu",
      "buna",
      "i\xE7inde",
      "\xFCzerinde",
      "aras\u0131nda",
      "sonucu",
      "taraf\u0131ndan",
      "zaten",
      "gayet",
      "acaba",
      "nedir",
      "midir",
      "mudur",
      // Generic technical
      "hook",
      "file",
      "dosya",
      "kullan",
      "ekle",
      "yaz",
      "oku",
      "\xE7al\u0131\u015Ft\u0131r",
      "kontrol",
      "test",
      "check",
      "run",
      "add",
      "update",
      "config",
      "setup",
      "install",
      "start",
      "stop",
      "create",
      "delete",
      "remove",
      "set",
      "get",
      "list",
      "show",
      "view",
      "open",
      "close",
      "save",
      "load"
    ]);
    var VERSION_RE = /v(\d+)\.(\d+)(?:\.(\d+))?/g;
    function fixVersionTokens(query) {
      return query.replace(VERSION_RE, (_m, a, b, c) => c ? `"v${a} ${b} ${c}"` : `"v${a} ${b}"`);
    }
    exports2.FTS5_COLUMNS = ["path", "slug", "description", "type", "category", "title", "content", "tags", "quality", "date_captured", "project"];
    exports2.FRONTMATTER_TYPES = ["raw", "source", "domain", "analysis", "diary", "decision", "insight", "connection", "learning", "feedback", "user", "project", "reference", "note"];
    exports2.QUALITY_VALUES = ["high", "medium", "low"];
    exports2.QUALITY_HEURISTICS = {
      "github-repo": "high",
      "docs": "high",
      "blog": "medium",
      "video": "medium",
      "x-thread": "medium",
      "text-paste": "low",
      "snippet": "low",
      "forum": "low",
      "cc-session": "low",
      "cc-subagent": "low"
    };
    exports2.RELATION_TYPES = ["cites", "extends", "contradicts", "supersedes"];
    exports2.SYMMETRIC_TYPES = /* @__PURE__ */ new Set(["contradicts"]);
    exports2.RELATION_PRIORITY = {
      supersedes: 1,
      contradicts: 2,
      extends: 3,
      cites: 4
    };
    exports2.MAX_RELATED_SOURCES = 5;
    exports2.RELATED_OVERFETCH = 10;
    function buildPriorityCase() {
      return Object.entries(exports2.RELATION_PRIORITY).map(([type, priority]) => `WHEN '${type}' THEN ${priority}`).join(" ");
    }
    exports2.TYPE_TO_DIR = {
      raw: "raw",
      source: "sources",
      domain: "domains",
      analysis: "analyses",
      insight: "insights",
      connection: "connections",
      learning: "learnings",
      decision: "decisions",
      diary: "diary",
      feedback: "memory",
      user: "memory",
      project: "memory",
      reference: "memory",
      note: "memory"
    };
    exports2.CC_MEMORY_PATH_MARKER = path_12.default.join(".claude", "projects");
    exports2.CC_MEMORY_DIR = "memory";
    exports2.CC_MEMORY_CATEGORY = "cc-memory";
    exports2.CC_SESSION_CATEGORY = "cc-session";
    exports2.CC_SUBAGENT_CATEGORY = "cc-subagent";
    exports2.CC_MEMORY_BOOST = 1.2;
    function homedir() {
      return os_12.default.homedir();
    }
    function getActiveMindloreDir() {
      return exports2.GLOBAL_MINDLORE_DIR;
    }
    function getAllDbs() {
      const dbPath = path_12.default.join(exports2.GLOBAL_MINDLORE_DIR, exports2.DB_NAME);
      if (fs_12.default.existsSync(dbPath))
        return [dbPath];
      return [];
    }
    function getProjectName() {
      return path_12.default.basename(process.cwd());
    }
    function log(msg) {
      console.log(`  ${msg}`);
    }
    function isContentFile(filePath) {
      return !exports2.SKIP_FILES.has(path_12.default.basename(filePath));
    }
    function resolveHookCommon(callerDir) {
      let dir = callerDir;
      for (let i = 0; i < 5; i++) {
        const target = path_12.default.join(dir, "hooks", "lib", "mindlore-common.cjs");
        if (fs_12.default.existsSync(target))
          return target;
        const parent = path_12.default.dirname(dir);
        if (parent === dir)
          break;
        dir = parent;
      }
      return path_12.default.resolve(callerDir, "..", "..", "hooks", "lib", "mindlore-common.cjs");
    }
    function hasYoutubeTranscript() {
      try {
        require.resolve("youtube-transcript");
        return true;
      } catch (_err) {
        return false;
      }
    }
    exports2.DEFAULT_TOKEN_BUDGET = {
      sessionInject: 2e3,
      searchResults: 1500,
      perResult: 500
    };
    exports2.DECAY_HALF_LIFE_DAYS = 30;
    exports2.STALE_THRESHOLD = 0.3;
    exports2.CONSOLIDATION_THRESHOLD = 50;
  }
});

// dist/scripts/lib/sync-helpers.js
var require_sync_helpers = __commonJS({
  "dist/scripts/lib/sync-helpers.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.UPSERT_HASH_SQL = void 0;
    exports2.getArg = getArg;
    exports2.UPSERT_HASH_SQL = `
  INSERT INTO file_hashes (path, content_hash, last_indexed, source_type)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(path) DO UPDATE SET
    content_hash = excluded.content_hash,
    last_indexed = excluded.last_indexed,
    source_type = excluded.source_type
`;
    function getArg(args, flag) {
      const idx = args.indexOf(flag);
      return idx !== -1 ? args[idx + 1] : void 0;
    }
  }
});

// dist/scripts/lib/secure-io.js
var require_secure_io = __commonJS({
  "dist/scripts/lib/secure-io.js"(exports2) {
    "use strict";
    var __importDefault2 = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.safeMkdir = safeMkdir;
    exports2.safeWriteFile = safeWriteFile;
    exports2.safeWriteJson = safeWriteJson;
    var fs_12 = __importDefault2(require("fs"));
    function safeMkdir(dirPath) {
      fs_12.default.mkdirSync(dirPath, { recursive: true, mode: 448 });
    }
    function safeWriteFile(filePath, data) {
      fs_12.default.writeFileSync(filePath, data, { encoding: "utf8", mode: 384 });
    }
    function safeWriteJson(filePath, obj) {
      safeWriteFile(filePath, JSON.stringify(obj, null, 2) + "\n");
    }
  }
});

// dist/scripts/lib/err-msg.js
var require_err_msg = __commonJS({
  "dist/scripts/lib/err-msg.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.errMsg = errMsg;
    function errMsg(err) {
      return err instanceof Error ? err.message : String(err);
    }
  }
});

// dist/scripts/cc-memory-bulk-sync.js
var __importDefault = exports && exports.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverCcMemoryFiles = discoverCcMemoryFiles;
exports.syncToDb = syncToDb;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var os_1 = __importDefault(require("os"));
var constants_js_1 = require_constants();
var sync_helpers_js_1 = require_sync_helpers();
var secure_io_js_1 = require_secure_io();
var err_msg_js_1 = require_err_msg();
function discoverCcMemoryFiles(claudeDir) {
  const projectsDir = path_1.default.join(claudeDir, "projects");
  if (!fs_1.default.existsSync(projectsDir))
    return [];
  const results = [];
  let projectEntries;
  try {
    projectEntries = fs_1.default.readdirSync(projectsDir, { withFileTypes: true });
  } catch (_err) {
    return [];
  }
  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory())
      continue;
    const memoryDir = path_1.default.join(projectsDir, projectEntry.name, "memory");
    if (!fs_1.default.existsSync(memoryDir))
      continue;
    let memoryEntries;
    try {
      memoryEntries = fs_1.default.readdirSync(memoryDir, { withFileTypes: true });
    } catch (_err) {
      continue;
    }
    for (const memEntry of memoryEntries) {
      if (!memEntry.isFile())
        continue;
      if (!memEntry.name.endsWith(".md"))
        continue;
      if (memEntry.name === "MEMORY.md")
        continue;
      results.push(path_1.default.join(memoryDir, memEntry.name));
    }
  }
  return results;
}
function safePrefix(dirName) {
  return dirName.replace(/[/\\]/g, "_").replace(/\.\./g, "_").replace(/[^\w\-. ]/g, "_").slice(0, 80);
}
function syncToDb(dbPath, files, mindloreDir) {
  const result = { synced: 0, skipped: 0, errors: [] };
  if (files.length === 0)
    return result;
  const common = require((0, constants_js_1.resolveHookCommon)(__dirname));
  const { sha256, parseFrontmatter, extractFtsMetadata, insertFtsRow, openDatabase } = common;
  const db = openDatabase(dbPath);
  if (!db) {
    result.errors.push(`Cannot open DB at ${dbPath}`);
    return result;
  }
  const memoryDestDir = path_1.default.join(mindloreDir, "memory");
  (0, secure_io_js_1.safeMkdir)(memoryDestDir);
  const getHash = db.prepare("SELECT content_hash FROM file_hashes WHERE path = ?");
  const upsertHash = db.prepare(sync_helpers_js_1.UPSERT_HASH_SQL);
  const deleteFts = db.prepare("DELETE FROM mindlore_fts WHERE path = ?");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const ops = [];
  for (const srcPath of files) {
    try {
      const projectName = safePrefix(path_1.default.basename(path_1.default.dirname(path_1.default.dirname(srcPath))));
      const destFileName = `${projectName}_${path_1.default.basename(srcPath)}`;
      const destPath = path_1.default.join(memoryDestDir, destFileName);
      const content = fs_1.default.readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n");
      const hash = sha256(content);
      const existing = getHash.get(destPath);
      if (existing && existing.content_hash === hash) {
        result.skipped++;
        continue;
      }
      const { meta, body } = parseFrontmatter(content);
      const ftsFields = extractFtsMetadata(meta, body, destPath, mindloreDir);
      fs_1.default.copyFileSync(srcPath, destPath);
      ops.push({ srcPath, destPath, hash, ftsFields, body, projectName });
    } catch (err) {
      const msg = (0, err_msg_js_1.errMsg)(err);
      result.errors.push(`${path_1.default.basename(srcPath)}: ${msg}`);
    }
  }
  const transaction = db.transaction(() => {
    for (const op of ops) {
      deleteFts.run(op.destPath);
      insertFtsRow(db, {
        path: op.destPath,
        slug: op.ftsFields.slug,
        description: op.ftsFields.description,
        type: op.ftsFields.type,
        category: constants_js_1.CC_MEMORY_CATEGORY,
        title: op.ftsFields.title,
        content: op.body,
        tags: op.ftsFields.tags,
        quality: op.ftsFields.quality,
        dateCaptured: op.ftsFields.dateCaptured,
        project: op.projectName
      });
      upsertHash.run(op.destPath, op.hash, now, constants_js_1.CC_MEMORY_CATEGORY);
      result.synced++;
    }
  });
  transaction();
  db.close();
  return result;
}
var isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
  const args = process.argv.slice(2);
  const claudeDir = (0, sync_helpers_js_1.getArg)(args, "--claude-dir") ?? path_1.default.join(os_1.default.homedir(), ".claude");
  const mindloreDir = (0, sync_helpers_js_1.getArg)(args, "--mindlore-dir") ?? constants_js_1.GLOBAL_MINDLORE_DIR;
  const dbPath = (0, sync_helpers_js_1.getArg)(args, "--db") ?? path_1.default.join(mindloreDir, constants_js_1.DB_NAME);
  const files = discoverCcMemoryFiles(claudeDir);
  console.log(`  Discovered ${files.length} CC memory file(s)`);
  const result = syncToDb(dbPath, files, mindloreDir);
  console.log(`  Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.error(`  ERROR: ${e}`);
    }
    process.exit(1);
  }
}
