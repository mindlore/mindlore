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
    exports2.CACHE_STALE_AGE_MS = exports2.NUDGE_COOLDOWN_HOURS = exports2.REFLECT_THRESHOLD_DAYS = exports2.LEARNINGS_TOTAL_CHAR_BUDGET = exports2.LEARNINGS_MAX_LINES_PER_LESSON = exports2.LEARNINGS_MAX_LESSONS = exports2.CONSOLIDATION_THRESHOLD = exports2.STALE_THRESHOLD = exports2.DECAY_HALF_LIFE_DAYS = exports2.DEFAULT_TOKEN_BUDGET = exports2.TELEMETRY_FILE_ROTATE_BYTES = exports2.TELEMETRY_OUTPUT_MAX_BYTES = exports2.TELEMETRY_FILENAME = exports2.CC_MEMORY_BOOST = exports2.CC_SUBAGENT_CATEGORY = exports2.CC_SESSION_CATEGORY = exports2.CC_MEMORY_CATEGORY = exports2.CC_MEMORY_DIR = exports2.CC_MEMORY_PATH_MARKER = exports2.CC_PLUGIN_CACHE_DIR = exports2.SLUG_OPTIONAL_TYPES = exports2.NESTED_DIR_TYPES = exports2.TYPE_TO_DIR = exports2.PRIORITY_CASE = exports2.RELATED_OVERFETCH = exports2.MAX_RELATED_SOURCES = exports2.RELATION_PRIORITY = exports2.SYMMETRIC_TYPES = exports2.RELATION_TYPES = exports2.QUALITY_HEURISTICS = exports2.QUALITY_VALUES = exports2.FRONTMATTER_TYPES = exports2.FTS5_COLUMNS = exports2.STOP_WORDS = exports2.TURKISH_WORD_RE = exports2.STOP_WORDS_MIN_LENGTH = exports2.SESSION_CATEGORIES = exports2.CATEGORIES = exports2.SCHEMA_VERSION = exports2.DEFAULT_MODELS = exports2.CONFIG_FILE = exports2.MCP_BUSY_TIMEOUT_MS = exports2.DB_BUSY_TIMEOUT_MS = exports2.SKIP_FILES = exports2.DIRECTORIES = exports2.DB_NAME = exports2.GLOBAL_MINDLORE_DIR = exports2.MINDLORE_DIR = exports2.KNOWN_HOOK_EVENTS = void 0;
    exports2.isKnownHookEvent = isKnownHookEvent;
    exports2.isSessionCategory = isSessionCategory;
    exports2.fixVersionTokens = fixVersionTokens;
    exports2.homedir = homedir;
    exports2.getActiveMindloreDir = getActiveMindloreDir;
    exports2.getAllDbs = getAllDbs;
    exports2.getProjectName = getProjectName;
    exports2.resolveProject = resolveProject;
    exports2.resolveMindloreHome = resolveMindloreHome;
    exports2.resolveTelemetryPath = resolveTelemetryPath;
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
    exports2.NESTED_DIR_TYPES = /* @__PURE__ */ new Set(["raw"]);
    exports2.SLUG_OPTIONAL_TYPES = /* @__PURE__ */ new Set(["raw", "compaction-snapshot"]);
    exports2.CC_PLUGIN_CACHE_DIR = path_12.default.join(os_12.default.homedir(), ".claude", "plugins", "cache");
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
    function resolveProject() {
      if (process.env.MINDLORE_PROJECT)
        return process.env.MINDLORE_PROJECT;
      return getProjectName().toLowerCase();
    }
    function resolveMindloreHome() {
      return process.env.MINDLORE_HOME ?? path_12.default.join(os_12.default.homedir(), exports2.MINDLORE_DIR);
    }
    exports2.TELEMETRY_FILENAME = "telemetry.jsonl";
    exports2.TELEMETRY_OUTPUT_MAX_BYTES = 4e3;
    exports2.TELEMETRY_FILE_ROTATE_BYTES = 10 * 1024 * 1024;
    function resolveTelemetryPath() {
      return process.env.MINDLORE_TELEMETRY_PATH ?? path_12.default.join(resolveMindloreHome(), exports2.TELEMETRY_FILENAME);
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
    exports2.LEARNINGS_MAX_LESSONS = 10;
    exports2.LEARNINGS_MAX_LINES_PER_LESSON = 5;
    exports2.LEARNINGS_TOTAL_CHAR_BUDGET = 6e3;
    exports2.REFLECT_THRESHOLD_DAYS = 7;
    exports2.NUDGE_COOLDOWN_HOURS = 24;
    exports2.CACHE_STALE_AGE_MS = 24 * 3600 * 1e3;
  }
});

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

// dist/scripts/cc-session-sync.js
var __importDefault = exports && exports.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECISION_KEYWORDS = void 0;
exports.discoverSessionFiles = discoverSessionFiles;
exports.buildSessionMarkdown = buildSessionMarkdown;
exports.convertJsonlToMd = convertJsonlToMd;
exports.extractSessionSummary = extractSessionSummary;
exports.syncSessions = syncSessions;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var os_1 = __importDefault(require("os"));
var constants_js_1 = require_constants();
var privacy_filter_js_1 = require_privacy_filter();
var sync_helpers_js_1 = require_sync_helpers();
var secure_io_js_1 = require_secure_io();
var err_msg_js_1 = require_err_msg();
function discoverSessionFiles(claudeDir) {
  const projectsDir = path_1.default.join(claudeDir, "projects");
  if (!fs_1.default.existsSync(projectsDir))
    return [];
  const results = [];
  let projectEntries;
  try {
    projectEntries = fs_1.default.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of projectEntries) {
    if (!entry.isDirectory())
      continue;
    const projDir = path_1.default.join(projectsDir, entry.name);
    let files;
    try {
      files = fs_1.default.readdirSync(projDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.isFile() && f.name.endsWith(".jsonl")) {
        const sessionId = f.name.replace(".jsonl", "");
        const fullPath = path_1.default.join(projDir, f.name);
        const stat = fs_1.default.statSync(fullPath);
        results.push({ jsonlPath: fullPath, sessionId, projectName: entry.name, mtime: stat.mtime });
        continue;
      }
      if (f.isDirectory() && f.name !== "memory") {
        const subagentsDir = path_1.default.join(projDir, f.name, "subagents");
        let subFiles;
        try {
          subFiles = fs_1.default.readdirSync(subagentsDir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const sf of subFiles) {
          if (!sf.isFile() || !sf.name.endsWith(".jsonl"))
            continue;
          const sessionId = sf.name.replace(".jsonl", "");
          const fullPath = path_1.default.join(subagentsDir, sf.name);
          const stat = fs_1.default.statSync(fullPath);
          results.push({ jsonlPath: fullPath, sessionId, projectName: entry.name, mtime: stat.mtime });
        }
      }
    }
  }
  return results;
}
function projectSlug(projectName) {
  const prefixMatch = projectName.match(/^C--Users-([^-]+)-(.*)$/);
  if (!prefixMatch?.[2])
    return projectName;
  const rest = prefixMatch[2];
  const KNOWN_USER_DIRS = ["Desktop", "Documents", "Downloads", "Projects", "dev"];
  for (const loc of KNOWN_USER_DIRS) {
    if (rest.startsWith(loc + "-")) {
      return rest.substring(loc.length + 1);
    }
  }
  return rest.replace(/^-+/, "") || projectName;
}
function extractSessionMeta(lines) {
  let date = "unknown";
  let branch = "";
  let cwd = "";
  let startTime = "";
  for (const line of lines.slice(0, 20)) {
    try {
      const obj = JSON.parse(line);
      if (obj.timestamp && date === "unknown") {
        date = obj.timestamp.substring(0, 10);
        startTime = obj.timestamp;
      }
      if (obj.gitBranch && !branch)
        branch = obj.gitBranch;
      if (obj.cwd && !cwd)
        cwd = obj.cwd;
    } catch {
      continue;
    }
  }
  return { date, branch, cwd, startTime };
}
function buildSessionMarkdown(messages, meta, projectName, shortId, isSubagent, sessionId = shortId) {
  const slug = projectSlug(projectName);
  const mdParts = [];
  let userCount = 0;
  let assistantCount = 0;
  for (const obj of messages) {
    if (obj.type === "user" || obj.type === "assistant") {
      const msgContent = obj.message?.content;
      const role = obj.type === "user" ? "User" : "Assistant";
      const texts = [];
      if (typeof msgContent === "string" && msgContent.trim()) {
        texts.push(msgContent.trim());
      } else if (Array.isArray(msgContent)) {
        for (const block of msgContent) {
          if (block.type === "text" && block.text?.trim()) {
            texts.push(block.text.trim());
          }
        }
      }
      for (const text of texts) {
        const cleaned = (0, privacy_filter_js_1.redactSecrets)(text);
        mdParts.push(`## ${role}

${cleaned}
`);
        if (obj.type === "user")
          userCount++;
        else
          assistantCount++;
      }
    }
  }
  const frontmatter = [
    "---",
    `type: raw`,
    `slug: session-${meta.date}-${shortId}`,
    `project: ${slug}`,
    `session_id: ${sessionId}`,
    `date: ${meta.date}`,
    meta.startTime ? `start_time: ${meta.startTime}` : null,
    meta.branch ? `branch: ${meta.branch}` : null,
    `messages: ${userCount} user, ${assistantCount} assistant`,
    `category: ${isSubagent ? "cc-subagent" : "cc-session"}`,
    "---",
    "",
    `# ${isSubagent ? "Subagent" : "Session"} ${meta.date} \u2014 ${slug}`,
    ""
  ].filter(Boolean).join("\n");
  const md = frontmatter + mdParts.join("\n");
  return { md, date: meta.date, userCount, assistantCount, isSubagent };
}
function convertJsonlToMd(jsonlPath, projectName) {
  const raw = fs_1.default.readFileSync(jsonlPath, "utf8").replace(/\r\n/g, "\n");
  const lines = raw.trim().split("\n");
  const meta = extractSessionMeta(lines);
  const sessionId = path_1.default.basename(jsonlPath, ".jsonl");
  const isSubagent = sessionId.startsWith("agent-");
  const shortId = sessionShortId(sessionId);
  const parsedMessages = [];
  for (const line of lines) {
    try {
      parsedMessages.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return buildSessionMarkdown(parsedMessages, meta, projectName, shortId, isSubagent, sessionId);
}
exports.DECISION_KEYWORDS = [
  "karar:",
  "ertele",
  "se\xE7tik",
  "yapma:",
  "decision:",
  "defer",
  "chose",
  "skip:",
  "blocker:",
  "ertelendi"
];
function extractSessionSummary(transcriptMd) {
  const lines = transcriptMd.split("\n");
  const userMessages = [];
  const decisions = [];
  let inUser = false;
  for (const line of lines) {
    if (line.startsWith("## User")) {
      inUser = true;
      continue;
    }
    if (line.startsWith("## ")) {
      inUser = false;
      continue;
    }
    if (inUser && line.trim()) {
      userMessages.push(line.trim());
      const lower = line.toLowerCase();
      if (exports.DECISION_KEYWORDS.some((kw) => lower.includes(kw))) {
        decisions.push(line.trim());
      }
    }
  }
  if (userMessages.length === 0)
    return "";
  const firstIntent = userMessages[0]?.slice(0, 100) ?? "";
  const lastIntent = userMessages[userMessages.length - 1]?.slice(0, 100) ?? "";
  const parts = [`Intent: ${firstIntent}`];
  if (lastIntent && lastIntent !== firstIntent) {
    parts.push(`Son: ${lastIntent}`);
  }
  if (decisions.length > 0) {
    parts.push(`Kararlar: ${decisions.slice(0, 5).join("; ")}`);
  }
  return parts.join(" | ");
}
function sessionShortId(sessionId) {
  return sessionId.startsWith("agent-") ? sessionId.slice(-8) : sessionId.substring(0, 8);
}
var ACTIVE_SESSION_THRESHOLD_MS = 2 * 60 * 1e3;
function syncSessions(dbPath, sessions, mindloreDir) {
  const result = { synced: 0, skipped: 0, errors: [] };
  if (sessions.length === 0)
    return result;
  const common = require((0, constants_js_1.resolveHookCommon)(__dirname));
  const { sha256, insertFtsRow, openDatabase } = common;
  const db = openDatabase(dbPath);
  if (!db) {
    result.errors.push(`Cannot open DB at ${dbPath}`);
    return result;
  }
  const getHash = db.prepare("SELECT content_hash, last_indexed FROM file_hashes WHERE path = ?");
  const upsertHash = db.prepare(sync_helpers_js_1.UPSERT_HASH_SQL);
  const deleteFts = db.prepare("DELETE FROM mindlore_fts WHERE path = ?");
  const now = /* @__PURE__ */ new Date();
  const nowIso = now.toISOString();
  const ops = [];
  for (const session of sessions) {
    const slug = projectSlug(session.projectName);
    const shortId = sessionShortId(session.sessionId);
    try {
      const ageMs = now.getTime() - session.mtime.getTime();
      if (ageMs < ACTIVE_SESSION_THRESHOLD_MS) {
        result.skipped++;
        continue;
      }
      const destDir = path_1.default.join(mindloreDir, "raw", "sessions", slug);
      const matchingFiles = fs_1.default.existsSync(destDir) ? fs_1.default.readdirSync(destDir).filter((f) => f.includes(shortId)) : [];
      const firstMatch = matchingFiles[0];
      if (firstMatch) {
        const existingPath = path_1.default.join(destDir, firstMatch);
        const cached = getHash.get(existingPath);
        if (cached && session.mtime <= new Date(cached.last_indexed)) {
          result.skipped++;
          continue;
        }
      }
      const { md, date: sessionDate, userCount, assistantCount, isSubagent } = convertJsonlToMd(session.jsonlPath, session.projectName);
      if (userCount === 0 && assistantCount === 0) {
        result.skipped++;
        continue;
      }
      const hash = sha256(md);
      const destPath = path_1.default.join(destDir, `${sessionDate}-${shortId}.md`);
      const existing = getHash.get(destPath);
      if (existing && existing.content_hash === hash) {
        result.skipped++;
        continue;
      }
      (0, secure_io_js_1.safeMkdir)(destDir);
      (0, secure_io_js_1.safeWriteFile)(destPath, md);
      ops.push({ destPath, hash, sessionDate, shortId, slug, md, isSubagent });
    } catch (err) {
      const msg = (0, err_msg_js_1.errMsg)(err);
      result.errors.push(`${shortId}: ${msg}`);
    }
  }
  const syncOne = db.transaction((op) => {
    const category = op.isSubagent ? constants_js_1.CC_SUBAGENT_CATEGORY : constants_js_1.CC_SESSION_CATEGORY;
    deleteFts.run(op.destPath);
    insertFtsRow(db, {
      path: op.destPath,
      slug: `session-${op.sessionDate}-${op.shortId}`,
      description: `CC ${op.isSubagent ? "subagent" : "session"} transcript \u2014 ${op.slug} \u2014 ${op.sessionDate}`,
      type: "raw",
      category,
      title: `${op.isSubagent ? "Subagent" : "Session"} ${op.sessionDate} \u2014 ${op.slug}`,
      content: op.md,
      tags: `${op.isSubagent ? "subagent" : "session"},${op.slug},transcript`,
      dateCaptured: op.sessionDate,
      project: op.slug
    });
    upsertHash.run(op.destPath, op.hash, nowIso, category);
    if (!op.isSubagent) {
      try {
        const sessionSummary = extractSessionSummary(op.md);
        if (sessionSummary) {
          const epSlug = `session-summary-${op.sessionDate}-${op.shortId}`;
          const shortSummary = sessionSummary.slice(0, 300);
          db.prepare(`INSERT OR REPLACE INTO episodes (id, kind, scope, project, summary, session_summary, created_at)
             VALUES (?, 'session-summary', 'project', ?, ?, ?, ?)`).run(epSlug, op.slug, shortSummary, sessionSummary, nowIso);
        }
      } catch {
      }
    }
    result.synced++;
  });
  for (const op of ops) {
    try {
      syncOne(op);
    } catch (err) {
      const msg = (0, err_msg_js_1.errMsg)(err);
      result.errors.push(`${op.shortId}: ${msg}`);
    }
  }
  db.close();
  return result;
}
var isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
  const args = process.argv.slice(2);
  const claudeDir = (0, sync_helpers_js_1.getArg)(args, "--claude-dir") ?? path_1.default.join(os_1.default.homedir(), ".claude");
  const mindloreDir = (0, sync_helpers_js_1.getArg)(args, "--mindlore-dir") ?? constants_js_1.GLOBAL_MINDLORE_DIR;
  const dbPath = (0, sync_helpers_js_1.getArg)(args, "--db") ?? path_1.default.join(mindloreDir, constants_js_1.DB_NAME);
  const sessions = discoverSessionFiles(claudeDir);
  console.log(`  Discovered ${sessions.length} session file(s)`);
  const result = syncSessions(dbPath, sessions, mindloreDir);
  console.log(`  Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.error(`  ERROR: ${e}`);
    }
    process.exit(1);
  }
}
