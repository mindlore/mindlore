#!/usr/bin/env node
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// dist/scripts/lib/session-payload.js
var require_session_payload = __commonJS({
  "dist/scripts/lib/session-payload.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.buildSessionPayload = buildSessionPayload;
    var crypto_1 = __importDefault(require("crypto"));
    var CHARS_PER_TOKEN = 4;
    function estimateTokens(text) {
      return Math.ceil(text.length / CHARS_PER_TOKEN);
    }
    function buildSessionSummary(_baseDir, latestDeltaContent) {
      if (!latestDeltaContent)
        return "No previous session data.";
      const lines = latestDeltaContent.split("\n").filter((l) => l.startsWith("- ") || l.startsWith("# "));
      return lines.slice(0, 10).join("\n") || "No previous session data.";
    }
    function buildEpisodeSections(db, project, sessionId) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
      const dedupClause = sessionId ? "AND rowid NOT IN (SELECT episode_id FROM episode_inject_log WHERE session_id = ?)" : "";
      const query = `SELECT rowid, kind, summary, created_at FROM episodes
     WHERE status = 'active' AND project = ?
       AND kind IN ('decision', 'friction', 'learning')
       AND created_at >= ?
       ${dedupClause}
     ORDER BY kind, created_at DESC`;
      const params = sessionId ? [project, sevenDaysAgo, sessionId] : [project, sevenDaysAgo];
      const rawRows = db.prepare(query).all(...params);
      const rows = rawRows;
      if (sessionId && rows.length > 0) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const insert = db.prepare(`INSERT OR IGNORE INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?, ?, ?)`);
        db.transaction(() => {
          for (const row of rows) {
            insert.run(sessionId, row.rowid, now);
          }
        })();
      }
      const grouped = { decision: [], friction: [], learning: [] };
      for (const row of rows) {
        const kind = row.kind;
        if (kind === "decision" || kind === "friction" || kind === "learning") {
          grouped[kind].push(row);
        }
      }
      const fmt = (items, limit) => items.slice(0, limit).map((r) => `- ${r.summary} (${r.created_at.slice(0, 10)})`).join("\n");
      return {
        decisions: grouped.decision.length > 0 ? fmt(grouped.decision, 5) : "No recent decisions.",
        friction: grouped.friction.length > 0 ? fmt(grouped.friction, 3) : "No active friction points.",
        learnings: grouped.learning.length > 0 ? fmt(grouped.learning, 5) : "No recent learnings."
      };
    }
    function buildSessionPayload(opts) {
      const { db, baseDir, project, tokenBudget = 2e3, latestDeltaContent, sessionId } = opts;
      const sections = [];
      const summary = buildSessionSummary(baseDir, latestDeltaContent);
      sections.push({ label: "Session", content: summary, tokens: estimateTokens(summary) });
      const episodes = buildEpisodeSections(db, project, sessionId);
      sections.push({ label: "Decisions", content: episodes.decisions, tokens: estimateTokens(episodes.decisions) });
      sections.push({ label: "Friction", content: episodes.friction, tokens: estimateTokens(episodes.friction) });
      sections.push({ label: "Learnings", content: episodes.learnings, tokens: estimateTokens(episodes.learnings) });
      try {
        const summaries = db.prepare(`SELECT session_summary, created_at FROM episodes
       WHERE kind = 'session-summary' AND project = ? AND session_summary IS NOT NULL
       ORDER BY created_at DESC LIMIT 3`).all(project);
        if (summaries.length > 0) {
          const content = summaries.map((s) => `- ${s.created_at.slice(0, 16)}: ${s.session_summary}`).join("\n");
          sections.push({ label: "Past Sessions", content: `# Son Sessionlar
${content}`, tokens: estimateTokens(content) });
        }
      } catch {
      }
      let totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
      while (totalTokens > tokenBudget && sections.length > 1) {
        const removed = sections.pop();
        if (!removed)
          break;
        totalTokens -= removed.tokens;
      }
      const allContent = sections.map((s) => s.content).join("|");
      const contentHash = crypto_1.default.createHash("md5").update(allContent).digest("hex").slice(0, 8);
      return { sections, totalTokens, contentHash };
    }
  }
});

// dist/scripts/lib/migrations-v051.js
var require_migrations_v051 = __commonJS({
  "dist/scripts/lib/migrations-v051.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V051_MIGRATIONS = void 0;
    exports2.V051_MIGRATIONS = [
      {
        version: 2,
        name: "add_source_type_and_project_scope",
        up: (db) => {
          const cols = db.pragma("table_info(file_hashes)");
          const colNames = new Set(cols.map((c) => c.name));
          if (!colNames.has("source_type")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN source_type TEXT DEFAULT 'mindlore'");
          }
          if (!colNames.has("project_scope")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN project_scope TEXT");
          }
          if (!colNames.has("content_hash")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN content_hash TEXT");
          }
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations.js
var require_migrations = __commonJS({
  "dist/scripts/lib/migrations.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V051_MIGRATIONS = exports2.V050_MIGRATIONS = void 0;
    exports2.V050_MIGRATIONS = [
      {
        version: 1,
        name: "add_vec_table_and_timestamps",
        up: (db) => {
          const cols = db.pragma("table_info(file_hashes)");
          const colNames = new Set(cols.map((c) => c.name));
          if (!colNames.has("created_at")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN created_at TEXT");
          }
          if (!colNames.has("updated_at")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN updated_at TEXT");
          }
        }
      }
    ];
    var migrations_v051_js_1 = require_migrations_v051();
    Object.defineProperty(exports2, "V051_MIGRATIONS", { enumerable: true, get: function() {
      return migrations_v051_js_1.V051_MIGRATIONS;
    } });
  }
});

// dist/scripts/lib/migrations-v052.js
var require_migrations_v052 = __commonJS({
  "dist/scripts/lib/migrations-v052.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V052_MIGRATIONS = void 0;
    exports2.V052_MIGRATIONS = [
      {
        version: 3,
        name: "add_skill_memory_table",
        up: (db) => {
          db.exec(`
        CREATE TABLE IF NOT EXISTS skill_memory (
          id INTEGER PRIMARY KEY,
          skill_name TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          access_count INTEGER DEFAULT 0,
          UNIQUE(skill_name, key)
        )
      `);
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations-v053.js
var require_migrations_v053 = __commonJS({
  "dist/scripts/lib/migrations-v053.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V053_MIGRATIONS = void 0;
    exports2.V053_MIGRATIONS = [
      {
        version: 4,
        name: "add_recall_telemetry_and_decay",
        up: (db) => {
          const cols = db.pragma("table_info(file_hashes)");
          const colNames = new Set(cols.map((c) => c.name));
          if (!colNames.has("recall_count")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN recall_count INTEGER DEFAULT 0");
          }
          if (!colNames.has("last_recalled_at")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN last_recalled_at TEXT");
          }
          if (!colNames.has("archived_at")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN archived_at TEXT");
          }
          if (!colNames.has("importance")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN importance REAL DEFAULT 1.0");
          }
        }
      },
      {
        version: 5,
        name: "add_episode_consolidation",
        up: (db) => {
          const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='episodes'").get();
          if (!table)
            return;
          const cols = db.pragma("table_info(episodes)");
          const colNames = new Set(cols.map((c) => c.name));
          if (!colNames.has("consolidation_status")) {
            db.exec("ALTER TABLE episodes ADD COLUMN consolidation_status TEXT DEFAULT 'raw'");
          }
          if (!colNames.has("consolidated_into")) {
            db.exec("ALTER TABLE episodes ADD COLUMN consolidated_into TEXT");
          }
          if (!colNames.has("decay_score")) {
            db.exec("ALTER TABLE episodes ADD COLUMN decay_score REAL");
          }
          if (!colNames.has("last_decay_calc")) {
            db.exec("ALTER TABLE episodes ADD COLUMN last_decay_calc TEXT");
          }
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations-v061.js
var require_migrations_v061 = __commonJS({
  "dist/scripts/lib/migrations-v061.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V061_MIGRATIONS = void 0;
    exports2.V061_MIGRATIONS = [
      {
        version: 6,
        name: "cleanup_project_category",
        up: (db) => {
          db.exec(`
        UPDATE mindlore_fts SET project = 'unknown'
        WHERE project LIKE '.mindlore%' OR project LIKE 'C--%'
      `);
          db.exec(`
        UPDATE mindlore_fts SET category = 'cc-subagent'
        WHERE category IN ('subagent', 'cc_subagent')
      `);
          db.exec(`
        UPDATE mindlore_fts SET category = 'cc-session'
        WHERE category IN ('session', 'cc_session')
      `);
        }
      },
      {
        version: 7,
        name: "split_fts_sessions",
        up: (db) => {
          db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts_sessions USING fts5(
          path, slug, description, type, category, title, content, tags,
          quality, date_captured, project
        )
      `);
          db.exec("BEGIN");
          try {
            db.exec(`
          INSERT INTO mindlore_fts_sessions (path, slug, description, type, category, title, content, tags, quality, date_captured, project)
          SELECT path, slug, description, type, category, title, content, tags, quality, date_captured, project
          FROM mindlore_fts
          WHERE category IN ('cc-subagent', 'cc-session')
        `);
            db.exec(`
          DELETE FROM mindlore_fts WHERE category IN ('cc-subagent', 'cc-session')
        `);
            db.exec("COMMIT");
          } catch (err) {
            db.exec("ROLLBACK");
            throw err;
          }
          const cols = db.pragma("table_info(file_hashes)");
          if (!cols.some((c) => c.name === "table_target")) {
            db.exec("ALTER TABLE file_hashes ADD COLUMN table_target TEXT DEFAULT 'mindlore_fts'");
          }
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations-v062.js
var require_migrations_v062 = __commonJS({
  "dist/scripts/lib/migrations-v062.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V062_MIGRATIONS = void 0;
    exports2.V062_MIGRATIONS = [
      {
        version: 8,
        name: "raw_metadata_table",
        up: (db) => {
          db.exec(`
        CREATE TABLE IF NOT EXISTS raw_metadata (
          path TEXT PRIMARY KEY,
          title TEXT,
          url TEXT,
          date_captured TEXT,
          headings TEXT,
          file_size INTEGER,
          line_count INTEGER,
          extracted_at TEXT NOT NULL
        )
      `);
        }
      },
      {
        version: 9,
        name: "episodes_session_summary",
        up: (db) => {
          const cols = db.pragma("table_info(episodes)");
          if (!cols.some((c) => c.name === "session_summary")) {
            db.exec("ALTER TABLE episodes ADD COLUMN session_summary TEXT");
          }
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations-v063.js
var require_migrations_v063 = __commonJS({
  "dist/scripts/lib/migrations-v063.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V063_MIGRATIONS = exports2.SQL_SEARCH_THROTTLE_CREATE = exports2.SQL_SEARCH_CACHE_CREATE = exports2.SQL_VOCABULARY_CREATE = exports2.SQL_FTS_TRIGRAM_CREATE = void 0;
    exports2.SQL_FTS_TRIGRAM_CREATE = "CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts_trigram USING fts5(path UNINDEXED, slug, description, type UNINDEXED, category, title, content, tags, quality UNINDEXED, date_captured UNINDEXED, project UNINDEXED, tokenize='trigram')";
    exports2.SQL_VOCABULARY_CREATE = "CREATE TABLE IF NOT EXISTS vocabulary (word TEXT PRIMARY KEY) WITHOUT ROWID";
    exports2.SQL_SEARCH_CACHE_CREATE = "CREATE TABLE IF NOT EXISTS search_cache (query_hash TEXT PRIMARY KEY, results_json TEXT NOT NULL, expires_at TEXT NOT NULL)";
    exports2.SQL_SEARCH_THROTTLE_CREATE = "CREATE TABLE IF NOT EXISTS search_throttle (session_id TEXT PRIMARY KEY, call_count INTEGER NOT NULL DEFAULT 0, last_call TEXT NOT NULL)";
    exports2.V063_MIGRATIONS = [
      {
        version: 10,
        name: "fts_trigram_table",
        up: (db) => {
          db.exec(exports2.SQL_FTS_TRIGRAM_CREATE);
          const porterCount = db.prepare("SELECT COUNT(*) as c FROM mindlore_fts").get().c;
          if (porterCount > 0) {
            db.exec(`
          INSERT INTO mindlore_fts_trigram(path, slug, description, type, category, title, content, tags, quality, date_captured, project)
          SELECT path, slug, description, type, category, title, content, tags, quality, date_captured, project
          FROM mindlore_fts
        `);
          }
        }
      },
      {
        version: 11,
        name: "vocabulary_table",
        up: (db) => {
          db.exec(exports2.SQL_VOCABULARY_CREATE);
        }
      },
      {
        version: 12,
        name: "chunks_table",
        up: (db) => {
          db.exec(`
        CREATE TABLE IF NOT EXISTS chunks (
          id INTEGER PRIMARY KEY,
          source_path TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          heading TEXT,
          breadcrumb TEXT,
          char_count INTEGER,
          UNIQUE(source_path, chunk_index)
        )
      `);
        }
      },
      {
        version: 13,
        name: "search_cache_tables",
        up: (db) => {
          db.exec(exports2.SQL_SEARCH_CACHE_CREATE);
          db.exec(exports2.SQL_SEARCH_THROTTLE_CREATE);
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations-v066.js
var require_migrations_v066 = __commonJS({
  "dist/scripts/lib/migrations-v066.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V066_MIGRATIONS = exports2.SQL_EPISODE_INJECT_LOG_CREATE = void 0;
    exports2.SQL_EPISODE_INJECT_LOG_CREATE = "CREATE TABLE IF NOT EXISTS episode_inject_log (session_id TEXT NOT NULL, episode_id TEXT NOT NULL, injected_at TEXT NOT NULL, PRIMARY KEY (session_id, episode_id))";
    exports2.V066_MIGRATIONS = [
      {
        version: 14,
        name: "episode_inject_log",
        up: (db) => {
          db.exec(exports2.SQL_EPISODE_INJECT_LOG_CREATE);
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations-v067.js
var require_migrations_v067 = __commonJS({
  "dist/scripts/lib/migrations-v067.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V067_MIGRATIONS = void 0;
    exports2.cleanupExpiredInjectLog = cleanupExpiredInjectLog;
    var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1e3;
    function cleanupExpiredInjectLog(db, ttlMs = THIRTY_DAYS_MS) {
      const cutoff = new Date(Date.now() - ttlMs).toISOString();
      const result = db.prepare("DELETE FROM episode_inject_log WHERE injected_at < ?").run(cutoff);
      return result.changes;
    }
    exports2.V067_MIGRATIONS = [
      {
        version: 15,
        name: "episodes_graduation_columns",
        up: (db) => {
          db.exec("ALTER TABLE episodes ADD COLUMN graduated_at TEXT");
          db.exec("ALTER TABLE episodes ADD COLUMN rejected_at TEXT");
          db.exec("ALTER TABLE episodes ADD COLUMN rejection_reason TEXT");
        }
      },
      {
        version: 16,
        name: "episode_inject_log_integer_fix",
        up: (db) => {
          db.exec(`
        CREATE TABLE episode_inject_log_new (
          session_id TEXT NOT NULL,
          episode_id INTEGER NOT NULL,
          injected_at TEXT NOT NULL,
          PRIMARY KEY (session_id, episode_id)
        )
      `);
          db.exec(`
        INSERT INTO episode_inject_log_new (session_id, episode_id, injected_at)
        SELECT session_id, CAST(episode_id AS INTEGER), injected_at
        FROM episode_inject_log
      `);
          db.exec("DROP TABLE episode_inject_log");
          db.exec("ALTER TABLE episode_inject_log_new RENAME TO episode_inject_log");
        }
      },
      {
        version: 17,
        name: "episode_inject_log_ttl",
        up: (db) => {
          cleanupExpiredInjectLog(db);
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations-v068.js
var require_migrations_v068 = __commonJS({
  "dist/scripts/lib/migrations-v068.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V068_MIGRATIONS = void 0;
    exports2.V068_MIGRATIONS = [
      {
        version: 18,
        name: "inject_log_injected_at_index",
        up: (db) => {
          db.exec("CREATE INDEX IF NOT EXISTS idx_inject_log_injected_at ON episode_inject_log(injected_at)");
        }
      },
      {
        version: 19,
        name: "drop_dead_vec_tables",
        up: (db) => {
          const shadowTables = [
            "documents_vec_info",
            "documents_vec_chunks",
            "documents_vec_rowids",
            "documents_vec_vector_chunks00",
            "documents_vec_metadatachunks00",
            "documents_vec_metadatatext00",
            "documents_vec_auxiliary"
          ];
          for (const table of shadowTables) {
            db.exec(`DROP TABLE IF EXISTS "${table}"`);
          }
          try {
            db.exec("DROP TABLE IF EXISTS documents_vec");
          } catch {
          }
        }
      }
    ];
  }
});

// dist/scripts/lib/migrations-v072.js
var require_migrations_v072 = __commonJS({
  "dist/scripts/lib/migrations-v072.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.V072_MIGRATIONS = void 0;
    exports2.V072_MIGRATIONS = [
      {
        version: 20,
        name: "create_mindlore_relations",
        up: (db) => {
          db.exec(`
        CREATE TABLE IF NOT EXISTS mindlore_relations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_a TEXT NOT NULL,
          source_b TEXT NOT NULL,
          relation_type TEXT NOT NULL CHECK(relation_type IN ('cites', 'extends', 'contradicts', 'supersedes')),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
          UNIQUE(source_a, source_b, relation_type)
        );
        CREATE INDEX IF NOT EXISTS idx_relations_source_a ON mindlore_relations(source_a);
        CREATE INDEX IF NOT EXISTS idx_relations_source_b ON mindlore_relations(source_b);
        CREATE INDEX IF NOT EXISTS idx_relations_type ON mindlore_relations(relation_type);
      `);
        }
      }
    ];
  }
});

// dist/scripts/lib/all-migrations.js
var require_all_migrations = __commonJS({
  "dist/scripts/lib/all-migrations.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.EXPECTED_SCHEMA_VERSION = exports2.INIT_MIGRATIONS = exports2.FTS_DB_MIGRATIONS = exports2.ALL_MIGRATIONS = void 0;
    var migrations_js_1 = require_migrations();
    var migrations_v052_js_1 = require_migrations_v052();
    var migrations_v053_js_1 = require_migrations_v053();
    var migrations_v061_js_1 = require_migrations_v061();
    var migrations_v062_js_1 = require_migrations_v062();
    var migrations_v063_js_1 = require_migrations_v063();
    var migrations_v066_js_1 = require_migrations_v066();
    var migrations_v067_js_1 = require_migrations_v067();
    var migrations_v068_js_1 = require_migrations_v068();
    var migrations_v072_js_1 = require_migrations_v072();
    exports2.ALL_MIGRATIONS = [
      ...migrations_js_1.V050_MIGRATIONS,
      ...migrations_js_1.V051_MIGRATIONS,
      ...migrations_v052_js_1.V052_MIGRATIONS,
      ...migrations_v053_js_1.V053_MIGRATIONS,
      ...migrations_v061_js_1.V061_MIGRATIONS,
      ...migrations_v062_js_1.V062_MIGRATIONS,
      ...migrations_v063_js_1.V063_MIGRATIONS,
      ...migrations_v066_js_1.V066_MIGRATIONS,
      ...migrations_v067_js_1.V067_MIGRATIONS,
      ...migrations_v068_js_1.V068_MIGRATIONS,
      ...migrations_v072_js_1.V072_MIGRATIONS
    ];
    var EPISODES_DEPENDENT = /* @__PURE__ */ new Set([9, 14, 15, 16, 17, 18]);
    exports2.FTS_DB_MIGRATIONS = exports2.ALL_MIGRATIONS.filter((m) => !EPISODES_DEPENDENT.has(m.version));
    exports2.INIT_MIGRATIONS = [
      ...migrations_v062_js_1.V062_MIGRATIONS,
      ...migrations_v063_js_1.V063_MIGRATIONS,
      ...migrations_v066_js_1.V066_MIGRATIONS,
      ...migrations_v067_js_1.V067_MIGRATIONS,
      ...migrations_v068_js_1.V068_MIGRATIONS,
      ...migrations_v072_js_1.V072_MIGRATIONS
    ];
    exports2.EXPECTED_SCHEMA_VERSION = Math.max(...exports2.ALL_MIGRATIONS.map((m) => m.version));
  }
});

// hooks/src/mindlore-session-focus.cjs
var fs = require("fs");
var path = require("path");
var { findMindloreDir, readConfig, openDatabase, hasEpisodesTable, querySupersededChains, formatSupersededChains, hookLog, getProjectName, parseFrontmatter, withTelemetry, withTimeoutDb, listSnapshots, isCorruptionError, recoverCorruptDb, getNominationCounts } = require("./lib/mindlore-common.cjs");
function truncateSection(content, sectionRegex, keepCount, label) {
  const match = content.match(sectionRegex);
  if (!match) return content;
  const lines = match[2].trim().split("\n");
  if (lines.length <= keepCount) return content;
  const kept = lines.slice(0, keepCount).join("\n");
  return content.replace(match[2].trim(), kept + `
- ...ve ${lines.length - keepCount} ${label} daha`);
}
function truncateCommits(content) {
  return truncateSection(content, /(## Commits\n)((?:- [^\n]+\n?)+)/, 5, "commit");
}
function truncateChangedFiles(content) {
  return truncateSection(content, /(## Changed Files\n)((?:- [^\n]+\n?)+)/, 10, "dosya");
}
function tryOpenDb(dbPath) {
  return openDatabase(dbPath, { readonly: true });
}
function getEpisodeStats(db, config, project) {
  const chains = querySupersededChains(db, { project, days: 7, limit: 5 });
  let consolidationMsg = null;
  try {
    const rawCount = withTimeoutDb(
      db,
      `SELECT COUNT(*) as cnt FROM episodes
       WHERE (consolidation_status = 'raw' OR consolidation_status IS NULL)
         AND kind IN ('learning','discovery','friction','decision','nomination')
         AND project = ?`,
      [project],
      { mode: "get" }
    );
    const cnt = rawCount?.cnt ?? 0;
    const consolThreshold = config?.consolidation?.threshold ?? 50;
    if (cnt >= consolThreshold) {
      consolidationMsg = `[Mindlore] ${cnt} raw episode birikti \u2014 \`/mindlore-maintain consolidate\` ile birle\u015Ftirmeyi d\xFC\u015F\xFCn.`;
    }
  } catch (_err) {
  }
  return { chains, consolidationMsg };
}
function checkStaleContent(db) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
    const row = withTimeoutDb(db, "SELECT COUNT(*) as cnt FROM file_hashes WHERE last_indexed < ?", [thirtyDaysAgo], { mode: "get" });
    const staleCount = row?.cnt ?? 0;
    if (staleCount > 3) {
      return `[Mindlore: ${staleCount} dosya 30+ gundur guncellenmemis \u2014 \`/mindlore-evolve\` dusun]`;
    }
  } catch (_staleErr) {
  }
  return null;
}
function loadDbContent({ db, baseDir, config, output, timings, latestDeltaContent, sessionId }) {
  const project = path.basename(process.cwd());
  const tPayload = Date.now();
  try {
    const { buildSessionPayload } = require_session_payload();
    const payloadBudget = config?.tokenBudget?.sessionInject ?? 2e3;
    const payload = buildSessionPayload({ db, baseDir, project, tokenBudget: payloadBudget, latestDeltaContent, sessionId });
    for (const section of payload.sections) {
      output.push(`[Mindlore ${section.label}]
${section.content}`);
    }
  } catch (_payloadErr) {
  }
  timings.db_payload = Date.now() - tPayload;
  const tSuperseded = Date.now();
  if (hasEpisodesTable(db)) {
    const { chains, consolidationMsg } = getEpisodeStats(db, config, project);
    if (chains.length > 0) {
      output.push(`[Mindlore Supersedes]
${formatSupersededChains(chains)}`);
    }
    if (consolidationMsg) {
      output.push(consolidationMsg);
    }
  }
  timings.db_episodes = Date.now() - tSuperseded;
  const tStale = Date.now();
  const staleMsg = checkStaleContent(db);
  if (staleMsg) {
    output.push(staleMsg);
  }
  timings.db_stale = Date.now() - tStale;
  try {
    const counts = getNominationCounts(db, project);
    if (counts.staged > 0) {
      output.push(`[Mindlore Nomination] ${counts.staged} karar bekliyor \u2014 /mindlore-reflect ile onayla`);
    }
    if (counts.staged >= (config?.graduation?.reflectThreshold ?? 5)) {
      output.push(`[Mindlore] ${counts.staged} bekleyen nomination var \u2014 \`/mindlore-reflect\` \xE7al\u0131\u015Ft\u0131r`);
    }
    if (counts.graduated > 0) {
      output.push(`[Mindlore Graduation] ${counts.graduated} lesson mezun oldu`);
    }
  } catch (_reflectErr) {
  }
}
function main() {
  const t0 = Date.now();
  const baseDir = findMindloreDir();
  if (!baseDir) return;
  let sessionId;
  try {
    const stdinData = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
    sessionId = stdinData.session_id || void 0;
  } catch {
    sessionId = void 0;
  }
  const output = [];
  const config = readConfig(baseDir);
  const timings = {};
  let sourceChars = 0;
  const tIndex = Date.now();
  const indexPath = path.join(baseDir, "INDEX.md");
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, "utf8").trim();
    sourceChars += content.length;
    output.push(`[Mindlore INDEX]
${content}`);
  }
  timings.index_read = Date.now() - tIndex;
  const tDiary = Date.now();
  const diaryDir = path.join(baseDir, "diary");
  let latestDeltaContent = void 0;
  if (fs.existsSync(diaryDir)) {
    try {
      const diaryFiles = listSnapshots(diaryDir).filter((f) => f.startsWith("delta-"));
      if (diaryFiles.length > 0) {
        const latestName = diaryFiles[diaryFiles.length - 1];
        const latestPath = path.join(diaryDir, latestName);
        const deltaContent = fs.readFileSync(latestPath, "utf8").trim();
        sourceChars += deltaContent.length;
        const { meta } = parseFrontmatter(deltaContent);
        const deltaProject = meta.project || null;
        const currentProject = getProjectName();
        if (!deltaProject || deltaProject.toLowerCase() === currentProject.toLowerCase()) {
          latestDeltaContent = deltaContent;
          output.push(`[Mindlore Delta: ${latestName}]
${truncateChangedFiles(truncateCommits(deltaContent))}`);
        }
      }
      const threshold = config?.reflect?.threshold ?? 5;
      if (diaryFiles.length >= threshold) {
        output.push(`[Mindlore] ${diaryFiles.length} diary entry birikti \u2014 \`/mindlore-log reflect\` calistirmayi dusun.`);
      }
    } catch (_err) {
    }
  }
  timings.diary_walk = Date.now() - tDiary;
  const tVersion = Date.now();
  const versionPath = path.join(baseDir, ".version");
  const pkgVersionPath = path.join(baseDir, ".pkg-version");
  try {
    if (fs.existsSync(versionPath) && fs.existsSync(pkgVersionPath)) {
      const installed = fs.readFileSync(versionPath, "utf8").trim();
      const pkgVersion = fs.readFileSync(pkgVersionPath, "utf8").trim();
      if (pkgVersion && pkgVersion !== installed) {
        output.push(`[Mindlore: Guncelleme mevcut (${installed} \u2192 ${pkgVersion}). \`npx mindlore init\` calistirin.]`);
      }
    }
  } catch (_err) {
  }
  timings.version_check = Date.now() - tVersion;
  const tDb = Date.now();
  const outputLenBeforeDb = output.reduce((s, o) => s + o.length, 0);
  try {
    const dbPath = path.join(baseDir, "mindlore.db");
    const tDbOpen = Date.now();
    const db = tryOpenDb(dbPath);
    timings.db_open = Date.now() - tDbOpen;
    timings.db_integrity = 0;
    if (db) {
      try {
        const tSchema = Date.now();
        try {
          const { EXPECTED_SCHEMA_VERSION } = require_all_migrations();
          const row = db.prepare("SELECT MAX(version) as v FROM schema_versions").get();
          const current = row?.v ?? 0;
          if (current < EXPECTED_SCHEMA_VERSION) {
            output.push(`[Mindlore: schema g\xFCncel de\u011Fil (v${current} \u2192 v${EXPECTED_SCHEMA_VERSION}). \`npx mindlore upgrade\` \xE7al\u0131\u015Ft\u0131r.]`);
          }
        } catch (_schemaErr) {
        }
        timings.schema_check = Date.now() - tSchema;
        loadDbContent({ db, baseDir, config, output, timings, latestDeltaContent, sessionId });
      } catch (err) {
        if (isCorruptionError(err)) {
          recoverCorruptDb(db, dbPath, "session-focus");
        }
      } finally {
        try {
          db.close();
        } catch {
        }
      }
    }
  } catch (_err) {
  }
  const outputLenAfterDb = output.reduce((s, o) => s + o.length, 0);
  sourceChars += outputLenAfterDb - outputLenBeforeDb;
  timings.db_total = Date.now() - tDb;
  timings.total = Date.now() - t0;
  hookLog("session-focus", "info", `timings: ${JSON.stringify(timings)}`);
  const budgetConfig = config?.tokenBudget ?? {};
  const maxInjectChars = (budgetConfig.sessionInject || 2e3) * 4;
  let joined = output.join("\n\n");
  if (joined.length > maxInjectChars) {
    joined = joined.slice(0, maxInjectChars) + "\n[...truncated by token budget]";
  }
  if (joined.length > 0) {
    process.stdout.write(joined + "\n");
  }
  const inject_tokens = Math.ceil(joined.length / 4);
  const source_tokens = Math.ceil(sourceChars / 4);
  return { inject_tokens, source_tokens };
}
withTelemetry("mindlore-session-focus", main).catch((err) => {
  hookLog("mindlore-session-focus", "error", err?.message ?? String(err));
  process.exit(0);
});
if (typeof module !== "undefined") {
  module.exports = { truncateCommits, truncateChangedFiles, getEpisodeStats, checkStaleContent };
}
