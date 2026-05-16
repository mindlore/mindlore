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

// node_modules/sqlite-vec/index.cjs
var require_sqlite_vec = __commonJS({
  "node_modules/sqlite-vec/index.cjs"(exports2, module2) {
    var { arch, platform } = require("node:process");
    var BASE_PACKAGE_NAME = "sqlite-vec";
    var ENTRYPOINT_BASE_NAME = "vec0";
    var supportedPlatforms = [["darwin", "x64"], ["linux", "x64"], ["darwin", "arm64"], ["win32", "x64"], ["linux", "arm64"]];
    var invalidPlatformErrorMessage = `Unsupported platform for ${BASE_PACKAGE_NAME}, on a ${platform}-${arch} machine. Supported platforms are (${supportedPlatforms.map(([p, a]) => `${p}-${a}`).join(",")}). Consult the ${BASE_PACKAGE_NAME} NPM package README for details.`;
    function validPlatform(platform2, arch2) {
      return supportedPlatforms.find(([p, a]) => platform2 === p && arch2 === a) !== void 0;
    }
    function extensionSuffix(platform2) {
      if (platform2 === "win32") return "dll";
      if (platform2 === "darwin") return "dylib";
      return "so";
    }
    function platformPackageName(platform2, arch2) {
      const os = platform2 === "win32" ? "windows" : platform2;
      return `${BASE_PACKAGE_NAME}-${os}-${arch2}`;
    }
    function getLoadablePath() {
      if (!validPlatform(platform, arch)) {
        throw new Error(
          invalidPlatformErrorMessage
        );
      }
      const packageName = platformPackageName(platform, arch);
      const loadablePath = require.resolve(packageName + "/" + ENTRYPOINT_BASE_NAME + "." + extensionSuffix(platform));
      return loadablePath;
    }
    function load(db) {
      db.loadExtension(getLoadablePath());
    }
    module2.exports = { getLoadablePath, load };
  }
});

// dist/scripts/lib/constants.js
var require_constants = __commonJS({
  "dist/scripts/lib/constants.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.CONSOLIDATION_THRESHOLD = exports2.STALE_THRESHOLD = exports2.DECAY_HALF_LIFE_DAYS = exports2.DEFAULT_TOKEN_BUDGET = exports2.CC_MEMORY_BOOST = exports2.CC_SUBAGENT_CATEGORY = exports2.CC_SESSION_CATEGORY = exports2.CC_MEMORY_CATEGORY = exports2.CC_MEMORY_DIR = exports2.CC_MEMORY_PATH_MARKER = exports2.CC_PLUGIN_CACHE_DIR = exports2.TYPE_TO_DIR = exports2.PRIORITY_CASE = exports2.RELATED_OVERFETCH = exports2.MAX_RELATED_SOURCES = exports2.RELATION_PRIORITY = exports2.SYMMETRIC_TYPES = exports2.RELATION_TYPES = exports2.QUALITY_HEURISTICS = exports2.QUALITY_VALUES = exports2.FRONTMATTER_TYPES = exports2.FTS5_COLUMNS = exports2.STOP_WORDS = exports2.TURKISH_WORD_RE = exports2.STOP_WORDS_MIN_LENGTH = exports2.SESSION_CATEGORIES = exports2.CATEGORIES = exports2.SCHEMA_VERSION = exports2.DEFAULT_MODELS = exports2.CONFIG_FILE = exports2.MCP_BUSY_TIMEOUT_MS = exports2.DB_BUSY_TIMEOUT_MS = exports2.SKIP_FILES = exports2.DIRECTORIES = exports2.DB_NAME = exports2.GLOBAL_MINDLORE_DIR = exports2.MINDLORE_DIR = exports2.KNOWN_HOOK_EVENTS = void 0;
    exports2.isKnownHookEvent = isKnownHookEvent;
    exports2.isSessionCategory = isSessionCategory;
    exports2.fixVersionTokens = fixVersionTokens;
    exports2.homedir = homedir;
    exports2.getActiveMindloreDir = getActiveMindloreDir;
    exports2.getAllDbs = getAllDbs2;
    exports2.getProjectName = getProjectName;
    exports2.log = log;
    exports2.isContentFile = isContentFile;
    exports2.resolveHookCommon = resolveHookCommon;
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
    exports2.PRIORITY_CASE = "WHEN 'supersedes' THEN 1 WHEN 'contradicts' THEN 2 WHEN 'extends' THEN 3 WHEN 'cites' THEN 4";
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
    exports2.CC_PLUGIN_CACHE_DIR = path_1.default.join(os_1.default.homedir(), ".claude", "plugins", "cache");
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
    function getAllDbs2() {
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

// dist/scripts/lib/db-helpers.js
var require_db_helpers = __commonJS({
  "dist/scripts/lib/db-helpers.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.dbGet = dbGet;
    exports2.dbAll = dbAll;
    exports2.dbPragma = dbPragma;
    exports2.withReadonlyDb = withReadonlyDb;
    exports2.openDatabaseTs = openDatabaseTs;
    var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
    var fs_1 = __importDefault(require("fs"));
    var vec = __importStar(require_sqlite_vec());
    var constants_js_1 = require_constants();
    function dbGet(db, sql, ...params) {
      const result = db.prepare(sql).get(...params);
      if (result === void 0)
        return void 0;
      if (typeof result !== "object" || result === null) {
        throw new TypeError(`Expected object from query, got ${typeof result}`);
      }
      return result;
    }
    function dbAll(db, sql, ...params) {
      const results = db.prepare(sql).all(...params);
      return results;
    }
    function dbPragma(db, pragma) {
      const result = db.pragma(pragma);
      return result;
    }
    function withReadonlyDb(dbPath, fn) {
      let db = null;
      try {
        db = new better_sqlite3_1.default(dbPath, { readonly: true });
        return fn(db);
      } catch {
        return void 0;
      } finally {
        db?.close();
      }
    }
    function openDatabaseTs(dbPath, options) {
      try {
        if (!fs_1.default.existsSync(dbPath))
          return null;
        const readonly = options?.readonly ?? false;
        const db = new better_sqlite3_1.default(dbPath, { readonly });
        if (!readonly) {
          db.pragma("journal_mode = WAL");
          db.pragma(`busy_timeout = ${constants_js_1.DB_BUSY_TIMEOUT_MS}`);
        }
        if (options?.loadVec) {
          vec.load(db);
        }
        return db;
      } catch {
        return null;
      }
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

// dist/scripts/lib/rrf.js
var require_rrf = __commonJS({
  "dist/scripts/lib/rrf.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.sanitizeFtsQuery = sanitizeFtsQuery;
    exports2.computeRRF = computeRRF;
    exports2.searchPorter = searchPorter;
    exports2.searchTrigram = searchTrigram;
    var db_helpers_js_1 = require_db_helpers();
    var err_msg_js_1 = require_err_msg();
    function sanitizeFtsQuery(query) {
      return query.replace(/["*(){}[\]^~:-]/g, " ").replace(/\s+/g, " ").trim();
    }
    var BM25_RANK_EXPR = "bm25(mindlore_fts, 1, 1, 1, 5.0, 1, 1) as bm";
    function computeRRF(porterResults, trigramResults, options = {}) {
      const k = options.k ?? 60;
      const scores = /* @__PURE__ */ new Map();
      for (const list of [porterResults, trigramResults]) {
        for (const r of list) {
          const existing = scores.get(r.slug);
          const rrfScore = 1 / (k + r.rank);
          if (existing) {
            existing.score += rrfScore;
          } else {
            scores.set(r.slug, { ...r, score: rrfScore });
          }
        }
      }
      let results = Array.from(scores.values()).sort((a, b) => b.score - a.score);
      if (options.dedupByPath) {
        const seen = /* @__PURE__ */ new Set();
        results = results.filter((r) => {
          if (seen.has(r.path))
            return false;
          seen.add(r.path);
          return true;
        });
      }
      return results;
    }
    function _searchFts(db, p) {
      const sql = p.project ? `SELECT path, slug, description, title, category, tags, content, ${p.rankExpr} FROM ${p.table} WHERE ${p.table} MATCH ? AND project = ? ORDER BY ${p.orderBy} LIMIT ?` : `SELECT path, slug, description, title, category, tags, content, ${p.rankExpr} FROM ${p.table} WHERE ${p.table} MATCH ? ORDER BY ${p.orderBy} LIMIT ?`;
      const params = p.project ? [p.query, p.project, p.limit] : [p.query, p.limit];
      return (0, db_helpers_js_1.dbAll)(db, sql, ...params).map((r, i) => ({ ...r, rank: i + 1, score: 0 }));
    }
    function searchPorter(db, options) {
      const sanitized = sanitizeFtsQuery(options.query);
      if (!sanitized)
        return [];
      return _searchFts(db, { table: "mindlore_fts", rankExpr: BM25_RANK_EXPR, orderBy: "bm", query: sanitized, project: options.project, limit: options.limit });
    }
    function searchTrigram(db, options) {
      const sanitized = sanitizeFtsQuery(options.query);
      if (!sanitized)
        return [];
      try {
        return _searchFts(db, { table: "mindlore_fts_trigram", rankExpr: "rank", orderBy: "rank", query: sanitized, project: options.project, limit: options.limit });
      } catch (err) {
        const msg = (0, err_msg_js_1.errMsg)(err);
        if (!msg.includes("no such table")) {
          console.warn(`searchTrigram: ${msg}`);
        }
        return [];
      }
    }
  }
});

// dist/scripts/lib/fuzzy.js
var require_fuzzy = __commonJS({
  "dist/scripts/lib/fuzzy.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.levenshtein = levenshtein;
    exports2.findClosestWords = findClosestWords;
    exports2.loadVocabulary = loadVocabulary;
    exports2.invalidateVocabCache = invalidateVocabCache;
    exports2.populateVocabulary = populateVocabulary;
    exports2.correctQuery = correctQuery;
    var db_helpers_js_1 = require_db_helpers();
    var constants_js_1 = require_constants();
    function levenshtein(a, b) {
      const m = a.length, n = b.length;
      const prev = new Int32Array(n + 1);
      const curr = new Int32Array(n + 1);
      for (let j = 0; j <= n; j++)
        prev[j] = j;
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
          curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
        }
        for (let j = 0; j <= n; j++)
          prev[j] = curr[j];
      }
      return prev[n];
    }
    function maxDistance(wordLen) {
      if (wordLen <= 4)
        return 1;
      if (wordLen <= 7)
        return 2;
      return 3;
    }
    function findClosestWords(word, vocabulary, limit = 3) {
      const maxDist = maxDistance(word.length);
      const lower = word.toLowerCase();
      const candidates = [];
      for (const v of vocabulary) {
        if (Math.abs(v.length - lower.length) > maxDist)
          continue;
        const dist = levenshtein(lower, v.toLowerCase());
        if (dist > 0 && dist <= maxDist) {
          candidates.push({ word: v, dist });
        }
      }
      return candidates.sort((a, b) => a.dist - b.dist).slice(0, limit).map((c) => c.word);
    }
    var vocabCache = null;
    function loadVocabulary(db) {
      const dbName = db.name;
      if (vocabCache && vocabCache.dbName === dbName)
        return vocabCache.words;
      const words = (0, db_helpers_js_1.dbAll)(db, "SELECT word FROM vocabulary").map((r) => r.word);
      vocabCache = { dbName, words };
      return words;
    }
    function invalidateVocabCache() {
      vocabCache = null;
    }
    function populateVocabulary(db, content) {
      const words = content.replace(constants_js_1.TURKISH_WORD_RE, " ").split(/\s+/).filter((w) => w.length >= 3).map((w) => w.toLowerCase());
      const unique = [...new Set(words)];
      const stmt = db.prepare("INSERT OR IGNORE INTO vocabulary (word) VALUES (?)");
      for (const w of unique)
        stmt.run(w);
    }
    function correctQuery(db, keywords) {
      const vocab = loadVocabulary(db);
      if (vocab.length === 0)
        return null;
      let corrected = false;
      const result = keywords.map((kw) => {
        const closest = findClosestWords(kw, vocab, 1);
        const match = closest[0];
        if (match !== void 0 && match !== kw) {
          corrected = true;
          return match;
        }
        return kw;
      });
      return corrected ? result : null;
    }
  }
});

// dist/scripts/lib/proximity.js
var require_proximity = __commonJS({
  "dist/scripts/lib/proximity.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.rerankByProximity = rerankByProximity;
    function findMinSpan(content, terms) {
      const lower = content.toLowerCase();
      const positions = terms.map((t) => {
        const pos = [];
        let idx = lower.indexOf(t);
        while (idx !== -1) {
          pos.push(idx);
          idx = lower.indexOf(t, idx + 1);
        }
        return pos;
      });
      if (positions.some((p) => p.length === 0))
        return Infinity;
      let minSpan = Infinity;
      for (let i = 0; i < positions[0].length; i++) {
        let maxPos = positions[0][i];
        let minPos = positions[0][i];
        for (let t = 1; t < terms.length; t++) {
          let bestDist = Infinity;
          let bestPos = 0;
          for (let j = 0; j < positions[t].length; j++) {
            const dist = Math.abs(positions[t][j] - positions[0][i]);
            if (dist < bestDist) {
              bestDist = dist;
              bestPos = positions[t][j];
            }
          }
          if (bestPos > maxPos)
            maxPos = bestPos;
          if (bestPos < minPos)
            minPos = bestPos;
        }
        const span = maxPos - minPos;
        if (span < minSpan)
          minSpan = span;
      }
      return minSpan;
    }
    function rerankByProximity(results, terms) {
      if (terms.length < 2)
        return results;
      return results.map((r) => {
        const span = findMinSpan(r.content ?? "", terms);
        const boost = span === Infinity ? 1 : 1 + 1 / (1 + span / 50);
        return { ...r, score: r.score * boost };
      }).sort((a, b) => b.score - a.score);
    }
  }
});

// dist/scripts/lib/snippet.js
var require_snippet = __commonJS({
  "dist/scripts/lib/snippet.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.extractSnippet = extractSnippet;
    function extractSnippet(content, terms, maxLen = 300) {
      if (!content || content.length <= maxLen)
        return content;
      const lower = content.toLowerCase();
      let bestPos = 0;
      let bestScore = 0;
      for (const term of terms) {
        const idx = lower.indexOf(term.toLowerCase());
        if (idx !== -1) {
          const windowStart = Math.max(0, idx - Math.floor(maxLen / 2));
          const windowEnd = Math.min(lower.length, idx + Math.floor(maxLen / 2));
          const window = lower.slice(windowStart, windowEnd);
          const termCount = terms.filter((t) => window.includes(t.toLowerCase())).length;
          if (termCount > bestScore) {
            bestScore = termCount;
            bestPos = idx;
          }
        }
      }
      const start = Math.max(0, bestPos - Math.floor(maxLen / 3));
      const end = Math.min(content.length, start + maxLen);
      let snippet = content.slice(start, end);
      if (start > 0)
        snippet = "..." + snippet;
      if (end < content.length)
        snippet = snippet + "...";
      return snippet;
    }
  }
});

// dist/scripts/lib/chunker.js
var require_chunker = __commonJS({
  "dist/scripts/lib/chunker.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.chunkMarkdown = chunkMarkdown;
    function chunkMarkdown(markdown, options = {}) {
      const maxChunkChars = options.maxChunkChars ?? 1e4;
      const lines = markdown.split("\n");
      const chunks = [];
      let currentLines = [];
      let currentHeading = null;
      const headingStack = [];
      let inCodeBlock = false;
      function flush() {
        const content = currentLines.join("\n").trim();
        if (content.length === 0)
          return;
        const breadcrumb = headingStack.length > 0 ? headingStack.join(" > ") : "";
        const chunk = {
          index: 0,
          heading: currentHeading,
          breadcrumb,
          content,
          charCount: content.length
        };
        if (chunk.charCount > maxChunkChars) {
          for (const c of splitOversized(chunk, maxChunkChars))
            chunks.push(c);
        } else {
          chunks.push(chunk);
        }
        currentLines = [];
      }
      for (const line of lines) {
        if (line.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          currentLines.push(line);
          continue;
        }
        if (inCodeBlock) {
          currentLines.push(line);
          continue;
        }
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
          flush();
          currentHeading = line;
          const level = headingMatch[1].length;
          while (headingStack.length > 0) {
            const top = headingStack[headingStack.length - 1];
            const topLevel = (top.match(/^#+/) ?? [""])[0].length;
            if (topLevel >= level)
              headingStack.pop();
            else
              break;
          }
          headingStack.push(line);
        }
        currentLines.push(line);
      }
      flush();
      return chunks.map((c, i) => ({ ...c, index: i }));
    }
    function splitOversized(chunk, maxChars) {
      const lines = chunk.content.split("\n");
      const result = [];
      let buffer = [];
      let bufLen = 0;
      for (const line of lines) {
        if (bufLen + line.length > maxChars && buffer.length > 0) {
          result.push({
            index: 0,
            heading: result.length === 0 ? chunk.heading : null,
            breadcrumb: chunk.breadcrumb,
            content: buffer.join("\n"),
            charCount: bufLen
          });
          buffer = [];
          bufLen = 0;
        }
        buffer.push(line);
        bufLen += line.length + 1;
      }
      if (buffer.length > 0) {
        result.push({
          index: 0,
          heading: result.length === 0 ? chunk.heading : null,
          breadcrumb: chunk.breadcrumb,
          content: buffer.join("\n"),
          charCount: bufLen
        });
      }
      return result;
    }
  }
});

// dist/scripts/lib/smart-snippet.js
var require_smart_snippet = __commonJS({
  "dist/scripts/lib/smart-snippet.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.extractSmartSnippet = extractSmartSnippet;
    var snippet_js_1 = require_snippet();
    var chunker_js_1 = require_chunker();
    function extractSmartSnippet(db, sourcePath, fullContent, terms, maxLen = 500) {
      if (!fullContent || fullContent.length <= maxLen) {
        return { snippet: fullContent, heading: null };
      }
      let chunks;
      try {
        chunks = db.prepare("SELECT chunk_index, heading, breadcrumb, char_count FROM chunks WHERE source_path = ? ORDER BY chunk_index").all(sourcePath);
      } catch {
        return { snippet: (0, snippet_js_1.extractSnippet)(fullContent, terms, maxLen), heading: null };
      }
      if (chunks.length === 0) {
        return { snippet: (0, snippet_js_1.extractSnippet)(fullContent, terms, maxLen), heading: null };
      }
      const parsedChunks = (0, chunker_js_1.chunkMarkdown)(fullContent);
      const lowerTerms = terms.map((t) => t.toLowerCase());
      let bestChunkIdx = -1;
      let bestScore = 0;
      for (let i = 0; i < parsedChunks.length; i++) {
        const parsed = parsedChunks[i];
        if (!parsed)
          continue;
        const chunkLower = parsed.content.toLowerCase();
        const score = lowerTerms.filter((t) => chunkLower.includes(t)).length;
        if (score > bestScore) {
          bestScore = score;
          bestChunkIdx = i;
        }
      }
      if (bestChunkIdx === -1) {
        return { snippet: (0, snippet_js_1.extractSnippet)(fullContent, terms, maxLen), heading: null };
      }
      const bestParsed = parsedChunks[bestChunkIdx];
      if (!bestParsed) {
        return { snippet: (0, snippet_js_1.extractSnippet)(fullContent, terms, maxLen), heading: null };
      }
      const chunkSnippet = (0, snippet_js_1.extractSnippet)(bestParsed.content, terms, maxLen);
      const heading = chunks[bestChunkIdx]?.heading ?? bestParsed.heading ?? null;
      return { snippet: chunkSnippet, heading };
    }
  }
});

// dist/scripts/lib/search-engine.js
var require_search_engine = __commonJS({
  "dist/scripts/lib/search-engine.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.extractKeywords = extractKeywords;
    exports2.search = search;
    var rrf_js_1 = require_rrf();
    var fuzzy_js_1 = require_fuzzy();
    var proximity_js_1 = require_proximity();
    var smart_snippet_js_1 = require_smart_snippet();
    var constants_js_1 = require_constants();
    function extractKeywords(text, maxKeywords) {
      const keywords = text.replace(constants_js_1.TURKISH_WORD_RE, " ").split(/\s+/).filter((w) => w.length >= constants_js_1.STOP_WORDS_MIN_LENGTH && !constants_js_1.STOP_WORDS.has(w.toLowerCase())).map((w) => w.toLowerCase());
      return maxKeywords ? keywords.slice(0, maxKeywords) : keywords;
    }
    function expandWithSynonyms(keywords, synonyms) {
      if (!synonyms)
        return keywords;
      const expanded = [...keywords];
      for (const kw of keywords) {
        const syns = synonyms[kw];
        if (syns)
          expanded.push(...syns);
      }
      return expanded;
    }
    var CATEGORY_WEIGHTS = {
      sources: 1.2,
      analyses: 1.15,
      domains: 1.1,
      episodes: 1,
      decisions: 1,
      raw: 0.9,
      sessions: 0.85,
      cc_memory: 1.3
    };
    var INTENT_CONFIG = {
      debug: {
        keywords: ["debug", "fix", "hata", "bug", "error", "crash", "fail"],
        boosts: { episodes: 1.3, raw: 1.1 }
      },
      research: {
        keywords: ["ara\u015Ft\u0131r", "bul", "search", "nedir", "nas\u0131l", "compare"],
        boosts: { sources: 1.3, analyses: 1.2 }
      },
      implementation: {
        keywords: [],
        boosts: { domains: 1.2, sessions: 1.1 }
      }
    };
    var INTENT_KEYS = Object.keys(INTENT_CONFIG);
    function detectIntent(query) {
      const lower = query.toLowerCase();
      for (const intent of INTENT_KEYS) {
        if (INTENT_CONFIG[intent].keywords.some((k) => lower.includes(k)))
          return intent;
      }
      return "implementation";
    }
    function search(db, query, options) {
      const maxResults = options.maxResults ?? 3;
      const keywords = extractKeywords(query);
      if (keywords.length === 0)
        return [];
      const expanded = expandWithSynonyms(keywords, options.synonyms);
      const queryStr = (0, constants_js_1.fixVersionTokens)(expanded.join(" "));
      const limit = 20;
      function fusedSearch(q) {
        return (0, rrf_js_1.computeRRF)((0, rrf_js_1.searchPorter)(db, { query: q, limit, project: options.project }), (0, rrf_js_1.searchTrigram)(db, { query: q, limit, project: options.project }), { dedupByPath: true });
      }
      let fused = fusedSearch(queryStr);
      if (fused.length === 0) {
        const corrected = (0, fuzzy_js_1.correctQuery)(db, keywords);
        if (corrected) {
          fused = fusedSearch((0, constants_js_1.fixVersionTokens)(corrected.join(" ")));
        }
      }
      const intent = detectIntent(query);
      const intentBoosts = INTENT_CONFIG[intent].boosts;
      for (const r of fused) {
        r.score *= CATEGORY_WEIGHTS[r.category] ?? 1;
        r.score *= intentBoosts[r.category] ?? 1;
      }
      fused.sort((a, b) => b.score - a.score);
      const ranked = (0, proximity_js_1.rerankByProximity)(fused.map((r) => ({
        slug: r.slug,
        path: r.path,
        title: r.title ?? "",
        description: r.description ?? "",
        category: r.category ?? "",
        tags: r.tags ?? "",
        score: r.score,
        content: r.content
      })), keywords);
      return ranked.slice(0, maxResults).map((r) => {
        const smart = r.content ? (0, smart_snippet_js_1.extractSmartSnippet)(db, r.path, r.content, keywords) : void 0;
        return {
          ...r,
          snippet: smart?.snippet,
          heading: smart?.heading ?? null
        };
      });
    }
  }
});

// dist/scripts/lib/search-cache.js
var require_search_cache = __commonJS({
  "dist/scripts/lib/search-cache.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SearchThrottle = exports2.SearchCache = void 0;
    var crypto_1 = __importDefault(require("crypto"));
    var CLEANUP_INTERVAL_MS = 6e4;
    var SearchCache = class {
      db;
      ttlMs;
      statsReady = false;
      stmtHit = null;
      stmtMiss = null;
      lastCleanup = 0;
      constructor(db, options = {}) {
        this.db = db;
        this.ttlMs = options.ttlMs ?? 3e5;
      }
      hash(query) {
        return crypto_1.default.createHash("sha256").update(query).digest("hex").slice(0, 16);
      }
      ensureStatsTable() {
        if (this.statsReady)
          return;
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        hits INTEGER NOT NULL DEFAULT 0,
        misses INTEGER NOT NULL DEFAULT 0
      )
    `);
        this.db.prepare("INSERT OR IGNORE INTO search_cache_stats (id, hits, misses) VALUES (1, 0, 0)").run();
        this.stmtHit = this.db.prepare("UPDATE search_cache_stats SET hits = hits + 1 WHERE id = 1");
        this.stmtMiss = this.db.prepare("UPDATE search_cache_stats SET misses = misses + 1 WHERE id = 1");
        this.statsReady = true;
      }
      getStats() {
        this.ensureStatsTable();
        const row = this.db.prepare("SELECT hits, misses FROM search_cache_stats WHERE id = 1").get();
        const total = row.hits + row.misses;
        return { hits: row.hits, misses: row.misses, hitRate: total > 0 ? row.hits / total : 0 };
      }
      resetStats() {
        this.ensureStatsTable();
        this.db.prepare("UPDATE search_cache_stats SET hits = 0, misses = 0 WHERE id = 1").run();
      }
      get(query) {
        const h = this.hash(query);
        const row = this.db.prepare("SELECT results_json FROM search_cache WHERE query_hash = ? AND expires_at > ?").get(h, (/* @__PURE__ */ new Date()).toISOString());
        if (!row) {
          this.ensureStatsTable();
          this.stmtMiss.run();
          this.cleanup();
          return null;
        }
        this.ensureStatsTable();
        this.stmtHit.run();
        return JSON.parse(row.results_json);
      }
      set(query, results) {
        const h = this.hash(query);
        const expiresAt = new Date(Date.now() + this.ttlMs).toISOString();
        this.db.prepare("INSERT OR REPLACE INTO search_cache (query_hash, results_json, expires_at) VALUES (?, ?, ?)").run(h, JSON.stringify(results), expiresAt);
      }
      invalidate() {
        this.db.exec("DELETE FROM search_cache");
      }
      cleanup() {
        const now = Date.now();
        if (now - this.lastCleanup < CLEANUP_INTERVAL_MS)
          return;
        this.lastCleanup = now;
        this.db.prepare("DELETE FROM search_cache WHERE expires_at < ?").run((/* @__PURE__ */ new Date()).toISOString());
      }
    };
    exports2.SearchCache = SearchCache;
    var SearchThrottle = class {
      db;
      constructor(db) {
        this.db = db;
      }
      incrementCallCount(sessionId) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const row = this.db.prepare(`
      INSERT INTO search_throttle (session_id, call_count, last_call)
      VALUES (?, 1, ?)
      ON CONFLICT(session_id) DO UPDATE SET call_count = call_count + 1, last_call = ?
      RETURNING call_count
    `).get(sessionId, now, now);
        return row?.call_count ?? 1;
      }
      getMaxResults(callCount) {
        if (callCount <= 10)
          return 3;
        if (callCount <= 20)
          return 1;
        return 0;
      }
    };
    exports2.SearchThrottle = SearchThrottle;
  }
});

// hooks/src/mindlore-search.cjs
var fs = require("fs");
var path = require("path");
var { getAllDbs, openDatabase, extractHeadings, readConfig, hookLog, incrementRecallCount, withTelemetry } = require("./lib/mindlore-common.cjs");
var MAX_RESULTS = 3;
var MIN_QUERY_WORDS = 3;
var searchEngineMod;
try {
  searchEngineMod = require_search_engine();
} catch (_err) {
}
var SearchCacheMod;
try {
  SearchCacheMod = require_search_cache();
} catch (_err) {
}
function parseStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) return { userMessage: "", sessionId: "unknown" };
    const parsed = JSON.parse(raw);
    const userMessage = parsed.prompt || parsed.content || parsed.message || parsed.query || raw;
    const sessionId = parsed.session_id || "unknown";
    return { userMessage, sessionId };
  } catch (_err) {
    return { userMessage: "", sessionId: "unknown" };
  }
}
function main() {
  const { userMessage, sessionId } = parseStdin();
  if (!userMessage || userMessage.length < MIN_QUERY_WORDS) return;
  let searchMs = 0;
  const dbPaths = getAllDbs();
  if (dbPaths.length === 0) return;
  if (!searchEngineMod) {
    hookLog("search", "warn", "search-engine module not available \u2014 skipping");
    return;
  }
  const project = path.basename(process.cwd());
  const config = readConfig(path.dirname(dbPaths[0]));
  const synonyms = config && config.synonyms ? config.synonyms : {};
  const allResults = [];
  for (const dbPath of dbPaths) {
    const db = openDatabase(dbPath);
    if (!db) continue;
    try {
      let cache;
      let effectiveMax = MAX_RESULTS;
      if (SearchCacheMod) {
        cache = new SearchCacheMod.SearchCache(db, { ttlMs: 3e5 });
        const throttle = new SearchCacheMod.SearchThrottle(db);
        const callCount = throttle.incrementCallCount(sessionId);
        effectiveMax = throttle.getMaxResults(callCount);
        if (effectiveMax === 0) {
          hookLog("search", "info", `Throttled (call #${callCount})`);
          db.close();
          continue;
        }
        const cached = cache.get(userMessage);
        if (cached) {
          const baseDir2 = path.dirname(dbPath);
          for (const r of cached) allResults.push({ ...r, baseDir: baseDir2 });
          db.close();
          continue;
        }
      }
      const t0 = Date.now();
      const results = searchEngineMod.search(db, userMessage, {
        project,
        maxResults: effectiveMax,
        synonyms
      });
      searchMs += Date.now() - t0;
      if (cache) cache.set(userMessage, results);
      const baseDir = path.dirname(dbPath);
      for (const r of results) {
        allResults.push({ ...r, baseDir });
      }
      try {
        const txn = db.transaction(() => {
          for (const r of results) incrementRecallCount(db, r.path);
        });
        txn();
      } catch (_e) {
      }
    } catch (err) {
      hookLog("search", "warn", `Search error: ${err?.message || err}`);
    } finally {
      db.close();
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const r of allResults) {
    const normalized = path.resolve(r.path);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(r);
    }
  }
  unique.sort((a, b) => b.score - a.score);
  const relevant = unique.slice(0, MAX_RESULTS);
  if (relevant.length === 0) return;
  const budget = config && config.tokenBudget || {};
  const perResultChars = (budget.perResult || 500) * 4;
  const totalChars = (budget.searchResults || 1500) * 4;
  const output = [];
  let totalUsed = 0;
  for (const r of relevant) {
    if (totalUsed >= totalChars) break;
    const relativePath = path.relative(r.baseDir, r.path).replace(/\\/g, "/");
    let headings = [];
    const contentStr = r.content || "";
    if (contentStr) {
      try {
        headings = extractHeadings(contentStr, 3);
      } catch (_err) {
      }
    }
    const category = r.category || path.dirname(relativePath).split("/")[0];
    const title = r.title || r.slug || path.basename(r.path, ".md");
    const description = r.description || "";
    const headingStr = headings.length > 0 ? `
Basliklar: ${headings.join(", ")}` : "";
    const tagsStr = r.tags ? `
Tags: ${r.tags}` : "";
    const snippetOrDesc = r.snippet || description;
    const entry = `[Mindlore: ${category}/${title}] ${snippetOrDesc}
Dosya: ${relativePath}${tagsStr}${headingStr}`;
    const truncated = entry.slice(0, perResultChars);
    totalUsed += truncated.length;
    output.push(truncated);
  }
  if (output.length > 0) {
    let outputStr = output.join("\n\n") + "\n";
    const OFFLOAD_THRESHOLD = 10240;
    if (outputStr.length > OFFLOAD_THRESHOLD) {
      const baseDir = path.dirname(dbPaths[0]);
      const tmpDir = path.join(baseDir, "tmp");
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        const oneHourAgo = Date.now() - 36e5;
        const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith("search-")).map((f) => ({ name: f, mtime: fs.statSync(path.join(tmpDir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
        for (let i = 0; i < files.length; i++) {
          if (i >= 20 || files[i].mtime < oneHourAgo) {
            try {
              fs.unlinkSync(path.join(tmpDir, files[i].name));
            } catch {
            }
          }
        }
      } catch {
      }
      const fileName = `search-${Date.now()}.md`;
      const filePath = path.join(tmpDir, fileName);
      fs.writeFileSync(filePath, outputStr, "utf8");
      const summary = outputStr.slice(0, 500).replace(/\n/g, " ").trim();
      outputStr = `[Mindlore Search: ${outputStr.length} chars offloaded to ${filePath}]
Summary: ${summary}...
[Read full results: ${filePath}]`;
      hookLog("search", "info", "offloaded to tmp/ (" + outputStr.length + " chars)");
    }
    process.stdout.write(outputStr);
  }
  return { search_ms: searchMs, result_count: relevant.length };
}
withTelemetry("mindlore-search", main).catch((err) => {
  hookLog("mindlore-search", "error", err?.message ?? String(err));
  process.exit(0);
});
