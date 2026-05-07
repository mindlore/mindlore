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

// hooks/src/lib/constants.cjs
var require_constants = __commonJS({
  "hooks/src/lib/constants.cjs"(exports2, module2) {
    "use strict";
    var EPISODE_KINDS = [
      "session",
      "decision",
      "event",
      "preference",
      "learning",
      "friction",
      "discovery",
      "nomination",
      "session-summary"
    ];
    function isValidKind(kind) {
      return typeof kind === "string" && EPISODE_KINDS.includes(kind);
    }
    var DB_BUSY_TIMEOUT_MS = 2e3;
    module2.exports = { EPISODE_KINDS, isValidKind, DB_BUSY_TIMEOUT_MS };
  }
});

// hooks/src/lib/secure-io.cjs
var require_secure_io = __commonJS({
  "hooks/src/lib/secure-io.cjs"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    function safeMkdir(dirPath) {
      fs2.mkdirSync(dirPath, { recursive: true, mode: 448 });
    }
    function safeWriteFile(filePath, data) {
      fs2.writeFileSync(filePath, data, { encoding: "utf8", mode: 384 });
    }
    function safeWriteJson(filePath, obj) {
      safeWriteFile(filePath, JSON.stringify(obj, null, 2) + "\n");
    }
    module2.exports = { safeMkdir, safeWriteFile, safeWriteJson };
  }
});

// dist/scripts/lib/constants.js
var require_constants2 = __commonJS({
  "dist/scripts/lib/constants.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.CONSOLIDATION_THRESHOLD = exports2.STALE_THRESHOLD = exports2.DECAY_HALF_LIFE_DAYS = exports2.DEFAULT_TOKEN_BUDGET = exports2.CC_MEMORY_BOOST = exports2.CC_SUBAGENT_CATEGORY = exports2.CC_SESSION_CATEGORY = exports2.CC_MEMORY_CATEGORY = exports2.CC_MEMORY_DIR = exports2.CC_MEMORY_PATH_MARKER = exports2.TYPE_TO_DIR = exports2.QUALITY_HEURISTICS = exports2.QUALITY_VALUES = exports2.FRONTMATTER_TYPES = exports2.FTS5_COLUMNS = exports2.STOP_WORDS = exports2.TURKISH_WORD_RE = exports2.STOP_WORDS_MIN_LENGTH = exports2.SESSION_CATEGORIES = exports2.CATEGORIES = exports2.SCHEMA_VERSION = exports2.DEFAULT_MODELS = exports2.CONFIG_FILE = exports2.MCP_BUSY_TIMEOUT_MS = exports2.DB_BUSY_TIMEOUT_MS = exports2.SKIP_FILES = exports2.DIRECTORIES = exports2.DB_NAME = exports2.GLOBAL_MINDLORE_DIR = exports2.MINDLORE_DIR = exports2.KNOWN_HOOK_EVENTS = void 0;
    exports2.isKnownHookEvent = isKnownHookEvent;
    exports2.isSessionCategory = isSessionCategory;
    exports2.fixVersionTokens = fixVersionTokens;
    exports2.homedir = homedir;
    exports2.getActiveMindloreDir = getActiveMindloreDir;
    exports2.getAllDbs = getAllDbs;
    exports2.getProjectName = getProjectName;
    exports2.log = log;
    exports2.isContentFile = isContentFile;
    exports2.resolveHookCommon = resolveHookCommon;
    exports2.hasMarkitdown = hasMarkitdown;
    exports2.hasYoutubeTranscript = hasYoutubeTranscript;
    var os_1 = __importDefault(require("os"));
    var fs_1 = __importDefault(require("fs"));
    var path_1 = __importDefault(require("path"));
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
    exports2.GLOBAL_MINDLORE_DIR = process.env.MINDLORE_HOME ?? path_1.default.join(os_1.default.homedir(), exports2.MINDLORE_DIR);
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
    exports2.CC_MEMORY_PATH_MARKER = path_1.default.join(".claude", "projects");
    exports2.CC_MEMORY_DIR = "memory";
    exports2.CC_MEMORY_CATEGORY = "cc-memory";
    exports2.CC_SESSION_CATEGORY = "cc-session";
    exports2.CC_SUBAGENT_CATEGORY = "cc-subagent";
    exports2.CC_MEMORY_BOOST = 1.2;
    function homedir() {
      return os_1.default.homedir();
    }
    function getActiveMindloreDir() {
      return exports2.GLOBAL_MINDLORE_DIR;
    }
    function getAllDbs() {
      const dbPath = path_1.default.join(exports2.GLOBAL_MINDLORE_DIR, exports2.DB_NAME);
      if (fs_1.default.existsSync(dbPath))
        return [dbPath];
      return [];
    }
    function getProjectName() {
      return path_1.default.basename(process.cwd());
    }
    function log(msg) {
      console.log(`  ${msg}`);
    }
    function isContentFile(filePath) {
      return !exports2.SKIP_FILES.has(path_1.default.basename(filePath));
    }
    function resolveHookCommon(callerDir) {
      let dir = callerDir;
      for (let i = 0; i < 5; i++) {
        const target = path_1.default.join(dir, "hooks", "lib", "mindlore-common.cjs");
        if (fs_1.default.existsSync(target))
          return target;
        const parent = path_1.default.dirname(dir);
        if (parent === dir)
          break;
        dir = parent;
      }
      return path_1.default.resolve(callerDir, "..", "..", "hooks", "lib", "mindlore-common.cjs");
    }
    var markitdownCached = null;
    function hasMarkitdown() {
      if (markitdownCached !== null)
        return markitdownCached;
      try {
        const cp = require("child_process");
        const { execSync } = cp;
        execSync("markitdown --version", { stdio: "pipe", timeout: 5e3 });
        markitdownCached = true;
      } catch (_err) {
        markitdownCached = false;
      }
      return markitdownCached;
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

// dist/scripts/lib/skeleton.js
var require_skeleton = __commonJS({
  "dist/scripts/lib/skeleton.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.extractSkeleton = extractSkeleton;
    function jsSkeleton(lines) {
      const kept = [];
      let depth = 0;
      let inMLComment = false;
      for (const line of lines) {
        const t = line.trim();
        if (t.includes("/*") && !t.includes("*/"))
          inMLComment = true;
        if (t.includes("*/")) {
          inMLComment = false;
          continue;
        }
        if (inMLComment)
          continue;
        const opens = (line.match(/\{/g) ?? []).length;
        const closes = (line.match(/\}/g) ?? []).length;
        const keep = depth === 0 && (t.startsWith("import ") || t.startsWith("export ") || t.startsWith("const ") || t.startsWith("let ") || t.startsWith("var ") || t.startsWith("function ") || t.startsWith("async function ") || t.startsWith("class ") || t.startsWith("interface ") || t.startsWith("type ") || t.startsWith("enum ") || t.startsWith("//") || t.startsWith("module.exports") || t.startsWith("require("));
        if (keep) {
          kept.push(line);
        } else if (depth === 0 && !t) {
          if (kept.length && kept[kept.length - 1] !== "")
            kept.push("");
        }
        depth = Math.max(0, depth + opens - closes);
      }
      return kept;
    }
    function pySkeleton(lines) {
      const kept = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const t = line.trim();
        if (!t) {
          if (kept.length && kept[kept.length - 1] !== "")
            kept.push("");
          continue;
        }
        const keep = t.startsWith("import ") || t.startsWith("from ") || t.startsWith("def ") || t.startsWith("async def ") || t.startsWith("class ") || t.startsWith("@") || t.startsWith("#") || Boolean(line.match(/^\S/) && t.match(/^[A-Z_][A-Z_0-9]*\s*=/));
        if (keep) {
          kept.push(line);
          if ((t.startsWith("def ") || t.startsWith("class ")) && i + 1 < lines.length) {
            const next = lines[i + 1].trim();
            if (next.startsWith('"""') || next.startsWith("'''"))
              kept.push(lines[i + 1]);
          }
        }
      }
      return kept;
    }
    function mdSkeleton(lines) {
      return lines.filter((l) => l.trim().startsWith("#"));
    }
    function extractSkeleton(content, ext) {
      const lines = content.split("\n");
      let kept;
      switch (ext.toLowerCase()) {
        case "js":
        case "ts":
        case "jsx":
        case "tsx":
        case "mjs":
        case "cjs":
          kept = jsSkeleton(lines);
          break;
        case "py":
          kept = pySkeleton(lines);
          break;
        case "md":
        case "txt":
        case "rst":
          kept = mdSkeleton(lines);
          break;
        default:
          return content;
      }
      if (kept.length >= lines.length * 0.75)
        return content;
      const label = `[SKELETON: ${lines.length} lines -> ${kept.length} shown]`;
      return label + "\n\n" + kept.join("\n").replace(/\n{3,}/g, "\n\n") + "\n\n[Full file: ask for specific function/section by name]";
    }
  }
});

// hooks/src/lib/mindlore-common.cjs
var require_mindlore_common = __commonJS({
  "hooks/src/lib/mindlore-common.cjs"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    var path = require("path");
    var crypto = require("crypto");
    var os = require("os");
    var { EPISODE_KINDS, isValidKind, DB_BUSY_TIMEOUT_MS } = require_constants();
    var { safeMkdir, safeWriteFile } = require_secure_io();
    var MINDLORE_DIR = ".mindlore";
    var DB_NAME = "mindlore.db";
    var SKIP_FILES = /* @__PURE__ */ new Set(["INDEX.md", "SCHEMA.md", "log.md"]);
    function globalDir() {
      if (process.env.MINDLORE_HOME) return process.env.MINDLORE_HOME;
      return path.join(os.homedir(), MINDLORE_DIR);
    }
    var GLOBAL_MINDLORE_DIR = globalDir();
    function findMindloreDir2() {
      const gDir = globalDir();
      if (fs2.existsSync(gDir)) return gDir;
      return null;
    }
    function getActiveMindloreDir() {
      return globalDir();
    }
    function isInsideMindloreDir(resolvedPath) {
      return resolvedPath.includes(path.sep + MINDLORE_DIR + path.sep) || resolvedPath.endsWith(path.sep + MINDLORE_DIR);
    }
    function extractMindloreBaseDir(resolvedPath) {
      const sepDir = path.sep + MINDLORE_DIR;
      let idx = resolvedPath.lastIndexOf(sepDir + path.sep);
      if (idx === -1 && resolvedPath.endsWith(sepDir)) {
        idx = resolvedPath.length - sepDir.length;
      }
      if (idx === -1) return null;
      return resolvedPath.slice(0, idx + sepDir.length);
    }
    function getAllDbs() {
      const dbPath = path.join(globalDir(), DB_NAME);
      if (fs2.existsSync(dbPath)) return [dbPath];
      return [];
    }
    function getProjectName() {
      return path.basename(process.cwd());
    }
    function resolveProject(ftsProject, filePath, cwdFallback) {
      if (ftsProject) return ftsProject;
      const normalized = filePath.replace(/\\/g, "/");
      const sessionMatch = normalized.match(/raw\/sessions\/([^/]+)\//);
      if (sessionMatch) return sessionMatch[1];
      const diaryMatch = normalized.match(/diary\/([^/]+)\//);
      if (diaryMatch) return diaryMatch[1];
      return cwdFallback;
    }
    function getLatestDelta(diaryDir) {
      if (!fs2.existsSync(diaryDir)) return null;
      const deltas = fs2.readdirSync(diaryDir).filter((f) => f.startsWith("delta-") && f.endsWith(".md")).sort().reverse();
      if (deltas.length === 0) return null;
      return path.join(diaryDir, deltas[0]);
    }
    function sha256(content) {
      return crypto.createHash("sha256").update(content, "utf8").digest("hex");
    }
    function parseFrontmatter(content) {
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) return { meta: {}, body: content };
      const meta = /* @__PURE__ */ Object.create(null);
      const lines = match[1].split("\n");
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        let value = line.slice(colonIdx + 1).trim();
        if (value.startsWith("[") && value.endsWith("]")) {
          value = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
        }
        if (typeof value === "string") {
          value = value.replace(/^["']|["']$/g, "");
        }
        meta[key] = value;
      }
      const bodyStart = content.indexOf("---", 3);
      const body = bodyStart !== -1 ? content.slice(bodyStart + 3).replace(/^\r?\n/, "") : content;
      return { meta, body };
    }
    function extractFtsMetadata(meta, body, filePath, baseDir) {
      const slug = meta.slug || path.basename(filePath, ".md");
      const description = meta.description || "";
      const type = meta.type || "";
      const relativePath = baseDir ? path.relative(baseDir, filePath) : filePath;
      const category = path.dirname(relativePath).split(path.sep)[0] || "root";
      let title = meta.title || meta.name || "";
      if (!title) {
        const headingMatch = body.match(/^#\s+(.+)/m);
        title = headingMatch ? headingMatch[1].trim() : path.basename(filePath, ".md");
      }
      let tags = "";
      if (meta.tags) {
        tags = Array.isArray(meta.tags) ? meta.tags.join(", ") : String(meta.tags);
      }
      const quality = meta.quality !== void 0 && meta.quality !== null ? meta.quality : null;
      const dateCaptured = meta.date_captured || meta.date || null;
      const project = meta.project || null;
      return { slug, description, type, category, title, tags, quality, dateCaptured, project };
    }
    var SQL_FTS_CREATE = "CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(path UNINDEXED, slug, description, type UNINDEXED, category, title, content, tags, quality UNINDEXED, date_captured UNINDEXED, project UNINDEXED, tokenize='porter unicode61')";
    var SQL_FTS_INSERT = "INSERT INTO mindlore_fts (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    var SQL_FTS_TRIGRAM_INSERT = "INSERT INTO mindlore_fts_trigram (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    var SQL_FTS_SESSIONS_CREATE = "CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts_sessions USING fts5(path, slug, description, type, category, title, content, tags, quality, date_captured, project)";
    var SQL_FTS_SESSIONS_INSERT = "INSERT INTO mindlore_fts_sessions (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    var SESSION_CATEGORIES = ["cc-subagent", "cc-session"];
    function isSessionCategory(category) {
      return SESSION_CATEGORIES.includes(category);
    }
    var VERSION_RE = /v(\d+)\.(\d+)(?:\.(\d+))?/g;
    function fixVersionTokens(query) {
      return query.replace(VERSION_RE, (_m, a, b, c) => c ? `"v${a} ${b} ${c}"` : `"v${a} ${b}"`);
    }
    function insertFtsRow(db, entry) {
      const vals = [
        entry.path || "",
        entry.slug || "",
        entry.description || "",
        entry.type || "",
        entry.category || "",
        entry.title || "",
        entry.content || "",
        entry.tags || "",
        entry.quality || null,
        entry.dateCaptured || null,
        entry.project || null
      ];
      db.prepare(SQL_FTS_INSERT).run(...vals);
      try {
        db.prepare(SQL_FTS_TRIGRAM_INSERT).run(...vals);
      } catch (_err) {
      }
    }
    function extractHeadings(content, max) {
      const headings = [];
      for (const line of content.split("\n")) {
        if (/^#{1,3}\s/.test(line)) {
          headings.push(line.replace(/^#+\s*/, "").trim());
          if (headings.length >= max) break;
        }
      }
      return headings;
    }
    function requireDatabase() {
      try {
        return require("better-sqlite3");
      } catch (_err) {
        return null;
      }
    }
    function openDatabase(dbPath, opts) {
      try {
        const Database = requireDatabase();
        if (!Database) return null;
        if (!fs2.existsSync(dbPath)) return null;
        const readonly = opts?.readonly ?? false;
        const db = new Database(dbPath, { readonly });
        if (!readonly) {
          db.pragma("journal_mode = WAL");
          db.pragma(`busy_timeout = ${DB_BUSY_TIMEOUT_MS}`);
        }
        return db;
      } catch (_err) {
        return null;
      }
    }
    function getAllMdFiles(dir, skip) {
      const skipSet = skip || SKIP_FILES;
      const results = [];
      if (!fs2.existsSync(dir)) return results;
      const entries = fs2.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...getAllMdFiles(fullPath, skipSet));
        } else if (entry.name.endsWith(".md") && !skipSet.has(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }
    function readHookStdin(fields) {
      let input = "";
      try {
        input = fs2.readFileSync(0, "utf8").trim();
      } catch (_err) {
        return "";
      }
      if (!input) return "";
      try {
        const parsed = JSON.parse(input);
        for (const f of fields) {
          if (parsed[f]) return parsed[f];
        }
      } catch (_err) {
      }
      return input;
    }
    function readConfig2(mindloreDir) {
      if (!mindloreDir) return null;
      const configPath = path.join(mindloreDir, "config.json");
      try {
        return JSON.parse(fs2.readFileSync(configPath, "utf8"));
      } catch (_err) {
        return null;
      }
    }
    function detectSchemaVersion(db) {
      try {
        db.prepare("SELECT tags, quality, date_captured, project FROM mindlore_fts LIMIT 0").run();
        return 11;
      } catch (_err11) {
        try {
          db.prepare("SELECT tags, quality, date_captured FROM mindlore_fts LIMIT 0").run();
          return 10;
        } catch (_err10) {
          try {
            db.prepare("SELECT tags, quality FROM mindlore_fts LIMIT 0").run();
            return 9;
          } catch (_err9) {
            try {
              db.prepare("SELECT slug, description, category, title FROM mindlore_fts LIMIT 0").run();
              return 7;
            } catch (_err7) {
              return 2;
            }
          }
        }
      }
    }
    var DEFAULT_MODELS2 = {
      ingest: "haiku",
      evolve: "sonnet",
      explore: "sonnet",
      default: "haiku"
    };
    var SQL_EPISODES_CREATE = `
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'project',
  project TEXT,
  summary TEXT NOT NULL,
  body TEXT,
  tags TEXT,
  entities TEXT,
  parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  supersedes TEXT,
  source TEXT,
  created_at TEXT NOT NULL
)`;
    var MULTI_SESSION_TOKEN_CAP_CHARS = 2500;
    var EPISODE_STATUSES_CJS = ["active", "superseded", "deleted", "staged", "reviewed", "approved", "rejected"];
    var SQL_EPISODES_INDEXES = [
      "CREATE INDEX IF NOT EXISTS idx_episodes_kind ON episodes(kind, status)",
      "CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project, status)",
      "CREATE INDEX IF NOT EXISTS idx_episodes_created ON episodes(created_at DESC)"
    ];
    function ensureEpisodesTable(db) {
      db.exec(SQL_EPISODES_CREATE);
      for (const idx of SQL_EPISODES_INDEXES) {
        db.exec(idx);
      }
    }
    function hasEpisodesTable(db) {
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='episodes'").get();
      return row !== void 0;
    }
    function generateEpisodeId() {
      const timestamp = Date.now().toString(36);
      const random = crypto.randomBytes(6).toString("hex");
      return `ep-${timestamp}-${random}`;
    }
    function insertBareEpisode(db, entry) {
      const id = entry.id || generateEpisodeId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.prepare(`
    INSERT INTO episodes (id, kind, scope, project, summary, body, tags, entities, parent_id, status, supersedes, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
        id,
        entry.kind || "session",
        entry.scope || "project",
        entry.project || null,
        entry.summary || "",
        entry.body || null,
        entry.tags || null,
        entry.entities ? JSON.stringify(entry.entities) : null,
        entry.parent_id || null,
        entry.supersedes || null,
        entry.source || "hook",
        now
      );
      return id;
    }
    function queryRecentEpisodes(db, opts) {
      const project = opts.project || null;
      const limit = opts.limit || 3;
      const hasConsolCol = db.pragma("table_info(episodes)").some((c) => c.name === "consolidation_status");
      const consolFilter = hasConsolCol ? " AND (consolidation_status IS NULL OR consolidation_status != 'consolidated')" : "";
      let sql = `SELECT kind, summary, created_at FROM episodes WHERE status = 'active'${consolFilter}`;
      const params = [];
      if (project) {
        sql += " AND project = ?";
        params.push(project);
      }
      sql += " ORDER BY created_at DESC LIMIT ?";
      params.push(limit);
      return db.prepare(sql).all(...params);
    }
    function querySupersededChains(db, opts) {
      const days = opts.days ?? 7;
      const limit = opts.limit ?? 5;
      const modifier = `-${days} days`;
      const rows = db.prepare(`
    SELECT new_ep.summary AS current_summary, old_ep.summary AS previous_summary, new_ep.body
    FROM episodes new_ep
    JOIN episodes old_ep ON new_ep.supersedes = old_ep.id
    WHERE new_ep.project = ?
      AND new_ep.created_at > datetime('now', ?)
      AND old_ep.status = 'superseded'
    ORDER BY new_ep.created_at DESC
    LIMIT ?
  `).all(opts.project, modifier, limit);
      return rows.map((row) => ({
        current: row.current_summary,
        previous: row.previous_summary,
        reason: parseReason(row.body)
      }));
    }
    function parseReason(body) {
      if (!body) return null;
      const match = body.match(/## Reason\n(.+?)(?:\n##|\n*$)/s);
      if (!match) return null;
      return match[1].trim().split("\n")[0];
    }
    function formatSupersededChains(chains) {
      if (chains.length === 0) return "";
      const lines = chains.map((c) => {
        const base = `- ${c.current} \u2190 ${c.previous}`;
        return c.reason ? `${base} (Reason: ${c.reason})` : base;
      });
      return lines.join("\n");
    }
    function queryMultiSessionEpisodes(db, opts) {
      const days = opts.days ?? 3;
      const limit = opts.limit ?? 20;
      const modifier = `-${days} days`;
      return db.prepare(`
    SELECT kind, summary, created_at
    FROM episodes
    WHERE project = ?
      AND status = 'active'
      AND kind != 'session'
      AND kind != 'nomination'
      AND created_at > datetime('now', ?)
    ORDER BY created_at DESC
    LIMIT ?
  `).all(opts.project, modifier, limit);
    }
    function formatMultiSessionEpisodes(episodes) {
      if (episodes.length === 0) return "";
      const byDate = {};
      for (const ep of episodes) {
        const date = (ep.created_at || "").slice(0, 10);
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(ep);
      }
      const lines = [];
      let totalChars = 0;
      for (const [date, eps] of Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]))) {
        if (totalChars > MULTI_SESSION_TOKEN_CAP_CHARS) break;
        if (eps.length <= 5) {
          for (const ep of eps) {
            const line = `- [${date}] ${ep.kind}: ${String(ep.summary).slice(0, 100)}`;
            totalChars += line.length;
            if (totalChars > MULTI_SESSION_TOKEN_CAP_CHARS) break;
            lines.push(line);
          }
        } else {
          const kindCounts = {};
          for (const ep of eps) {
            kindCounts[ep.kind] = (kindCounts[ep.kind] || 0) + 1;
          }
          const counts = Object.entries(kindCounts).map(([k, c]) => `${c} ${k}`).join(", ");
          lines.push(`- [${date}] ${counts}`);
        }
      }
      return lines.join("\n");
    }
    var SHARED_STOP_WORDS = (() => {
      try {
        const { STOP_WORDS: STOP_WORDS2, STOP_WORDS_MIN_LENGTH: STOP_WORDS_MIN_LENGTH2 } = require_constants2();
        return { STOP_WORDS: STOP_WORDS2, MIN_LENGTH: STOP_WORDS_MIN_LENGTH2 };
      } catch {
        return null;
      }
    })();
    if (!SHARED_STOP_WORDS) {
      hookLog2("common", "warn", "STOP_WORDS fallback active \u2014 run npm run build");
    }
    var STOP_WORDS = SHARED_STOP_WORDS?.STOP_WORDS ?? /* @__PURE__ */ new Set(["the", "a", "an", "is", "are", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "bir", "bu", "de", "da", "ve"]);
    var STOP_WORDS_MIN_LENGTH = SHARED_STOP_WORDS?.MIN_LENGTH ?? 2;
    function extractKeywords(text, maxKeywords = 8) {
      const words = text.toLowerCase().replace(/[^\w\s\u00e7\u011f\u0131\u00f6\u015f\u00fc-]/g, " ").split(/\s+/).filter((w) => w.length >= STOP_WORDS_MIN_LENGTH && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
      return [...new Set(words)].slice(0, maxKeywords);
    }
    function sanitizeKeyword(kw) {
      const clean = kw.replace(/["*(){}[\]^~:]/g, "").replace(/-/g, " ").trim();
      return clean.length >= 2 ? `"${clean}"` : null;
    }
    var SHARED_EXPORT_DIRS = (() => {
      try {
        const { DIRECTORIES } = require_constants2();
        return [...DIRECTORIES, "memory"];
      } catch {
        return ["raw", "sources", "domains", "analyses", "insights", "connections", "learnings", "diary", "decisions", "memory"];
      }
    })();
    function resolveWin32Bin(name) {
      if (process.platform === "win32") {
        try {
          return require("child_process").execSync(`where ${name}`, { encoding: "utf8", timeout: 3e3, windowsHide: true }).trim().split("\n")[0].trim();
        } catch (_e) {
        }
      }
      return name;
    }
    var extractSkeleton = (() => {
      try {
        return require_skeleton().extractSkeleton;
      } catch {
        return (content) => content;
      }
    })();
    var TELEMETRY_KEEP_LINES = 200;
    function _rotateFile(filePath, maxBytes, keepLines) {
      try {
        const stat = fs2.statSync(filePath);
        if (stat.size > maxBytes) {
          const lines = fs2.readFileSync(filePath, "utf8").trim().split("\n");
          const tmpPath = filePath + ".tmp";
          safeWriteFile(tmpPath, lines.slice(-keepLines).join("\n") + "\n");
          fs2.renameSync(tmpPath, filePath);
        }
      } catch {
      }
    }
    var _telDirEnsured = false;
    function _writeTelemetry({ hookName, duration_ms, ok, extra }) {
      try {
        if (!_telDirEnsured) {
          safeMkdir(GLOBAL_MINDLORE_DIR);
          _telDirEnsured = true;
        }
        const telPath = path.join(GLOBAL_MINDLORE_DIR, "telemetry.jsonl");
        const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), hook: hookName, duration_ms, ok };
        if (extra && typeof extra === "object") {
          for (const key of ["inject_tokens", "source_tokens", "injected_tokens", "full_read_tokens"]) {
            if (typeof extra[key] === "number") entry[key] = extra[key];
          }
        }
        const line = JSON.stringify(entry) + "\n";
        _rotateFile(telPath, HOOK_LOG_MAX_BYTES, TELEMETRY_KEEP_LINES);
        fs2.appendFileSync(telPath, line);
      } catch {
      }
    }
    async function withTelemetry(hookName, fn) {
      const start = Date.now();
      let ok = true;
      let result;
      let thrown;
      try {
        result = await fn();
      } catch (err) {
        ok = false;
        thrown = err;
      }
      const extra = result && typeof result === "object" ? result : void 0;
      _writeTelemetry({ hookName, duration_ms: Date.now() - start, ok, extra });
      if (thrown) throw thrown;
      return result;
    }
    function withTelemetrySync2(hookName, fn) {
      const start = Date.now();
      let ok = true;
      let result;
      let thrown;
      try {
        result = fn();
      } catch (err) {
        ok = false;
        thrown = err;
      }
      const extra = result && typeof result === "object" ? result : void 0;
      _writeTelemetry({ hookName, duration_ms: Date.now() - start, ok, extra });
      if (thrown) throw thrown;
      return result;
    }
    function withTimeoutDb(db, sql, params = [], { timeoutMs = DB_BUSY_TIMEOUT_MS, mode = "all" } = {}) {
      if (!db) return mode === "get" ? void 0 : [];
      try {
        db.pragma(`busy_timeout = ${timeoutMs}`);
        const stmt = db.prepare(sql);
        if (mode === "get") {
          return params.length > 0 ? stmt.get(...params) : stmt.get();
        }
        return params.length > 0 ? stmt.all(...params) : stmt.all();
      } catch (err) {
        hookLog2("timeout", "warn", `DB query timeout/error: ${err.message}`);
        _writeTelemetry({ hookName: "db_timeout", duration_ms: 0, ok: false });
        return mode === "get" ? void 0 : [];
      }
    }
    function getNominationCounts(db, project) {
      try {
        const row = withTimeoutDb(
          db,
          `SELECT
        SUM(CASE WHEN status='staged' THEN 1 ELSE 0 END) AS staged,
        SUM(CASE WHEN status='approved' AND graduated_at IS NOT NULL THEN 1 ELSE 0 END) AS graduated
      FROM episodes
      WHERE kind='nomination' AND project=?`,
          [project],
          { mode: "get" }
        );
        return { staged: row?.staged ?? 0, graduated: row?.graduated ?? 0 };
      } catch (_err) {
        return { staged: 0, graduated: 0 };
      }
    }
    function cleanupExpiredInjectLog(db, ttlMs) {
      if (ttlMs === void 0) ttlMs = 30 * 24 * 60 * 60 * 1e3;
      try {
        const cutoff = new Date(Date.now() - ttlMs).toISOString();
        const result = db.prepare("DELETE FROM episode_inject_log WHERE injected_at < ?").run(cutoff);
        return result.changes;
      } catch (_err) {
      }
      return 0;
    }
    module2.exports = {
      MINDLORE_DIR,
      GLOBAL_MINDLORE_DIR,
      globalDir,
      DB_NAME,
      SKIP_FILES,
      findMindloreDir: findMindloreDir2,
      getActiveMindloreDir,
      getAllDbs,
      getLatestDelta,
      sha256,
      parseFrontmatter,
      extractFtsMetadata,
      readHookStdin,
      SQL_FTS_CREATE,
      SQL_FTS_INSERT,
      SQL_FTS_TRIGRAM_INSERT,
      SQL_FTS_SESSIONS_CREATE,
      SQL_FTS_SESSIONS_INSERT,
      SESSION_CATEGORIES,
      isSessionCategory,
      fixVersionTokens,
      insertFtsRow,
      extractHeadings,
      requireDatabase,
      openDatabase,
      getAllMdFiles,
      readConfig: readConfig2,
      detectSchemaVersion,
      getProjectName,
      resolveProject,
      DEFAULT_MODELS: DEFAULT_MODELS2,
      // Episodes (v0.4.1)
      EPISODE_KINDS,
      EPISODE_KINDS_CJS: EPISODE_KINDS,
      isValidKind,
      EPISODE_STATUSES_CJS,
      SQL_EPISODES_CREATE,
      SQL_EPISODES_INDEXES,
      ensureEpisodesTable,
      hasEpisodesTable,
      generateEpisodeId,
      insertBareEpisode,
      queryRecentEpisodes,
      querySupersededChains,
      formatSupersededChains,
      queryMultiSessionEpisodes,
      formatMultiSessionEpisodes,
      // FTS5 search utilities (v0.4.3)
      STOP_WORDS,
      extractKeywords,
      sanitizeKeyword,
      // Hook logging (v0.5.1)
      hookLog: hookLog2,
      getRecentHookErrors,
      // Shared helpers (v0.5.1)
      SHARED_EXPORT_DIRS,
      resolveWin32Bin,
      // Skeleton compression (v0.5.2)
      extractSkeleton,
      // Recall telemetry (v0.5.3)
      incrementRecallCount,
      _rotateFile,
      isInsideMindloreDir,
      extractMindloreBaseDir,
      // Telemetry (v0.6.0)
      withTelemetry,
      withTelemetrySync: withTelemetrySync2,
      // DB timeout wrapper (v0.6.1)
      withTimeoutDb,
      // Raw file helpers (v0.6.3)
      getUnpromotedRawFiles,
      // Snapshot helpers (v0.6.3)
      listSnapshots,
      getLatestSnapshot,
      // DB corruption recovery (v0.6.3)
      isCorruptionError,
      recoverCorruptDb,
      // Lesson graduation (v0.6.7)
      getNominationCounts,
      cleanupExpiredInjectLog
    };
    function isCorruptionError(err) {
      const code = err?.code ?? "";
      const msg = String(err?.message ?? err);
      return code === "SQLITE_CORRUPT" || code === "SQLITE_NOTADB" || /corrupt|malformed/i.test(msg);
    }
    function recoverCorruptDb(db, dbPath, hookName) {
      try {
        db.close();
      } catch {
      }
      const bakPath = dbPath + ".corrupt.bak";
      try {
        fs2.copyFileSync(dbPath, bakPath);
      } catch {
      }
      try {
        fs2.unlinkSync(dbPath);
      } catch {
      }
      hookLog2(hookName, "warn", "corrupt DB detected, backed up and removed: " + dbPath);
    }
    function listSnapshots(diaryDir) {
      if (!fs2.existsSync(diaryDir)) return [];
      return fs2.readdirSync(diaryDir).filter((f) => f.startsWith("delta-") || f.startsWith("compaction-")).sort();
    }
    function getLatestSnapshot(diaryDir) {
      const files = listSnapshots(diaryDir);
      return files.length > 0 ? files[files.length - 1] : null;
    }
    function getUnpromotedRawFiles(baseDir) {
      const rawDir = path.join(baseDir, "raw");
      const sourcesDir = path.join(baseDir, "sources");
      if (!fs2.existsSync(rawDir)) return [];
      const sourceNames = fs2.existsSync(sourcesDir) ? new Set(fs2.readdirSync(sourcesDir).filter((f) => f.endsWith(".md"))) : /* @__PURE__ */ new Set();
      return fs2.readdirSync(rawDir).filter((f) => f.endsWith(".md") && !sourceNames.has(f));
    }
    var _recallColCache = /* @__PURE__ */ new WeakMap();
    function incrementRecallCount(db, filePath) {
      try {
        let hasCol = _recallColCache.get(db);
        if (hasCol === void 0) {
          hasCol = db.pragma("table_info(file_hashes)").some((c) => c.name === "recall_count");
          _recallColCache.set(db, hasCol);
        }
        if (!hasCol) return;
        db.prepare(`
      UPDATE file_hashes
      SET recall_count = COALESCE(recall_count, 0) + 1,
          last_recalled_at = ?
      WHERE path = ?
    `).run((/* @__PURE__ */ new Date()).toISOString(), filePath);
      } catch (_err) {
      }
    }
    function hookLogPath() {
      return path.join(globalDir(), "diary", "_hook-log.jsonl");
    }
    var HOOK_LOG_MAX_BYTES = 512 * 1024;
    var HOOK_LOG_KEEP_LINES = 500;
    function hookLog2(hook, level, message) {
      try {
        const logFile = hookLogPath();
        const entry = JSON.stringify({
          ts: (/* @__PURE__ */ new Date()).toISOString(),
          hook,
          level,
          msg: message,
          pid: process.pid
        });
        _rotateFile(logFile, HOOK_LOG_MAX_BYTES, HOOK_LOG_KEEP_LINES);
        fs2.appendFileSync(logFile, entry + "\n");
      } catch (_err) {
      }
    }
    function getRecentHookErrors(since, limit) {
      const maxEntries = limit ?? 10;
      const cutoff = since ?? new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
      const results = [];
      try {
        if (!fs2.existsSync(hookLogPath())) return results;
        const lines = fs2.readFileSync(hookLogPath(), "utf8").trim().split("\n");
        for (let i = lines.length - 1; i >= 0 && results.length < maxEntries; i--) {
          if (!lines[i]) continue;
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.ts < cutoff) break;
            if (entry.level === "error" || entry.level === "warn") {
              results.push(entry);
            }
          } catch (_parseErr) {
          }
        }
      } catch (_err) {
      }
      return results.reverse();
    }
  }
});

// hooks/src/mindlore-model-router.cjs
var fs = require("fs");
var { findMindloreDir, readConfig, DEFAULT_MODELS, hookLog, withTelemetrySync } = require_mindlore_common();
var SKILL_KEYS = Object.keys(DEFAULT_MODELS).filter((k) => k !== "default");
var MARKER_REGEX = new RegExp(`\\[mindlore:(${SKILL_KEYS.join("|")})\\]`);
function main() {
  const mindloreDir = findMindloreDir();
  if (!mindloreDir) return;
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
  const prompt = toolInput.prompt || "";
  const match = prompt.match(MARKER_REGEX);
  if (!match) return;
  const skill = match[1];
  const config = readConfig(mindloreDir);
  const models = config && config.models || {};
  const model = models[skill] || models.default || DEFAULT_MODELS[skill] || DEFAULT_MODELS.default;
  const updatedInput = { ...toolInput, model };
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput
    }
  };
  process.stdout.write(JSON.stringify(output));
}
try {
  withTelemetrySync("mindlore-model-router", main);
} catch (err) {
  hookLog("model-router", "error", err?.message ?? String(err));
}
