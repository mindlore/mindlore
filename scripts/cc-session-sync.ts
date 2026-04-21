#!/usr/bin/env node

/**
 * cc-session-sync — Convert CC JSONL session transcripts to searchable MD files.
 *
 * Discovers ~/.claude/projects/*\/*.jsonl, extracts user+assistant messages,
 * writes to .mindlore/raw/sessions/{project}/{date}-{uuid}.md.
 * Idempotent via SHA256 content-hash + mtime short-circuit. Skips active session.
 *
 * Usage: node dist/scripts/cc-session-sync.js [--claude-dir <path>] [--mindlore-dir <path>] [--db <path>]
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  DB_NAME,
  GLOBAL_MINDLORE_DIR,
  resolveHookCommon,
} from './lib/constants.js';
import { redactSecrets } from './lib/privacy-filter.js';

// ── Types ─────────────────────────────────────────────────────────────

interface CommonModule {
  sha256: (content: string) => string;
  insertFtsRow: (
    db: import('better-sqlite3').Database,
    entry: {
      path: string;
      slug?: string;
      description?: string;
      type?: string;
      category?: string;
      title?: string;
      content?: string;
      tags?: string;
      dateCaptured?: string | null;
      project?: string | null;
    },
  ) => void;
  openDatabase: (dbPath: string) => import('better-sqlite3').Database | null;
}

export interface SessionSyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

interface JsonLine {
  type: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>;
  };
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
}

// ── Discovery ─────────────────────────────────────────────────────────

export interface SessionFile {
  jsonlPath: string;
  sessionId: string;
  projectName: string;
  mtime: Date;
}

export function discoverSessionFiles(claudeDir: string): SessionFile[] {
  const projectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const results: SessionFile[] = [];

  let projectEntries: fs.Dirent[];
  try {
    projectEntries = fs.readdirSync(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of projectEntries) {
    if (!entry.isDirectory()) continue;
    const projDir = path.join(projectsDir, entry.name);

    let files: fs.Dirent[];
    try {
      files = fs.readdirSync(projDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const f of files) {
      // Flat JSONL: projects/{project}/{session-id}.jsonl
      if (f.isFile() && f.name.endsWith('.jsonl')) {
        const sessionId = f.name.replace('.jsonl', '');
        const fullPath = path.join(projDir, f.name);
        const stat = fs.statSync(fullPath);
        results.push({ jsonlPath: fullPath, sessionId, projectName: entry.name, mtime: stat.mtime });
        continue;
      }

      // Nested UUID dir: projects/{project}/{uuid}/subagents/*.jsonl
      if (f.isDirectory() && f.name !== 'memory') {
        const subagentsDir = path.join(projDir, f.name, 'subagents');
        let subFiles: fs.Dirent[];
        try {
          subFiles = fs.readdirSync(subagentsDir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const sf of subFiles) {
          if (!sf.isFile() || !sf.name.endsWith('.jsonl')) continue;
          const sessionId = sf.name.replace('.jsonl', '');
          const fullPath = path.join(subagentsDir, sf.name);
          const stat = fs.statSync(fullPath);
          results.push({ jsonlPath: fullPath, sessionId, projectName: entry.name, mtime: stat.mtime });
        }
      }
    }
  }

  return results;
}

// ── JSONL → MD Conversion ─────────────────────────────────────────────

function projectSlug(projectName: string): string {
  const prefixMatch = projectName.match(/^C--Users-([^-]+)-(.*)$/);
  if (!prefixMatch?.[2]) return projectName;

  const rest = prefixMatch[2];
  const KNOWN_USER_DIRS = ['Desktop', 'Documents', 'Downloads', 'Projects', 'dev'] as const;
  for (const loc of KNOWN_USER_DIRS) {
    if (rest.startsWith(loc + '-')) {
      return rest.substring(loc.length + 1);
    }
  }

  return rest.replace(/^-+/, '') || projectName;
}

function extractSessionMeta(lines: string[]): { date: string; branch: string; cwd: string; startTime: string } {
  let date = 'unknown';
  let branch = '';
  let cwd = '';
  let startTime = '';

  for (const line of lines.slice(0, 20)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown
      const obj = JSON.parse(line) as JsonLine;
      if (obj.timestamp && date === 'unknown') {
        date = obj.timestamp.substring(0, 10);
        startTime = obj.timestamp;
      }
      if (obj.gitBranch && !branch) branch = obj.gitBranch;
      if (obj.cwd && !cwd) cwd = obj.cwd;
    } catch {
      continue;
    }
  }

  return { date, branch, cwd, startTime };
}

export interface SessionConversion {
  md: string;
  date: string;
  userCount: number;
  assistantCount: number;
  isSubagent: boolean;
}

export function convertJsonlToMd(jsonlPath: string, projectName: string): SessionConversion {
  const raw = fs.readFileSync(jsonlPath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.trim().split('\n');

  const meta = extractSessionMeta(lines);
  const slug = projectSlug(projectName);
  const sessionId = path.basename(jsonlPath, '.jsonl');
  const isSubagent = sessionId.startsWith('agent-');

  const mdParts: string[] = [];
  let userCount = 0;
  let assistantCount = 0;

  for (const line of lines) {
    let obj: JsonLine;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse returns unknown
      obj = JSON.parse(line) as JsonLine;
    } catch {
      continue;
    }

    if (obj.type === 'user' || obj.type === 'assistant') {
      const content = obj.message?.content;
      const role = obj.type === 'user' ? 'User' : 'Assistant';
      const texts: string[] = [];

      if (typeof content === 'string' && content.trim()) {
        texts.push(content.trim());
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text?.trim()) {
            texts.push(block.text.trim());
          }
        }
      }

      for (const text of texts) {
        const cleaned = redactSecrets(text);
        mdParts.push(`## ${role}\n\n${cleaned}\n`);
        if (obj.type === 'user') userCount++;
        else assistantCount++;
      }
    }
  }

  const frontmatter = [
    '---',
    `type: raw`,
    `project: ${slug}`,
    `session_id: ${sessionId}`,
    `date: ${meta.date}`,
    meta.startTime ? `start_time: ${meta.startTime}` : null,
    meta.branch ? `branch: ${meta.branch}` : null,
    `messages: ${userCount} user, ${assistantCount} assistant`,
    `category: ${isSubagent ? 'cc-subagent' : 'cc-session'}`,
    '---',
    '',
    `# ${isSubagent ? 'Subagent' : 'Session'} ${meta.date} — ${slug}`,
    '',
  ].filter(Boolean).join('\n');

  const md = frontmatter + mdParts.join('\n');
  return { md, date: meta.date, userCount, assistantCount, isSubagent };
}

// ── Sync ──────────────────────────────────────────────────────────────

function sessionShortId(sessionId: string): string {
  return sessionId.startsWith('agent-') ? sessionId.slice(-8) : sessionId.substring(0, 8);
}

const SESSION_CATEGORY = 'cc-session';
const SUBAGENT_CATEGORY = 'cc-subagent';
// Skip files modified in the last 2 minutes — active session still being written to.
// Session-end hook runs after close, so 2 min is generous; CLI invocations benefit from a small guard.
const ACTIVE_SESSION_THRESHOLD_MS = 2 * 60 * 1000;

export function syncSessions(
  dbPath: string,
  sessions: SessionFile[],
  mindloreDir: string,
): SessionSyncResult {
  const result: SessionSyncResult = { synced: 0, skipped: 0, errors: [] };
  if (sessions.length === 0) return result;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- resolveHookCommon validated at startup
  const common = require(resolveHookCommon(__dirname)) as CommonModule;
  const { sha256, insertFtsRow, openDatabase } = common;

  const db = openDatabase(dbPath);
  if (!db) {
    result.errors.push(`Cannot open DB at ${dbPath}`);
    return result;
  }

  const getHash = db.prepare('SELECT content_hash, last_indexed FROM file_hashes WHERE path = ?');
  const upsertHash = db.prepare(`
    INSERT INTO file_hashes (path, content_hash, last_indexed, source_type)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      last_indexed = excluded.last_indexed,
      source_type = excluded.source_type
  `);
  const deleteFts = db.prepare('DELETE FROM mindlore_fts WHERE path = ?');

  const now = new Date();
  const nowIso = now.toISOString();

  const syncOne = db.transaction((session: SessionFile, slug: string, shortId: string) => {
    const { md, date: sessionDate, userCount, assistantCount, isSubagent } = convertJsonlToMd(session.jsonlPath, session.projectName);

    if (userCount === 0 && assistantCount === 0) {
      result.skipped++;
      return;
    }

    const hash = sha256(md);
    const destDir = path.join(mindloreDir, 'raw', 'sessions', slug);
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, `${sessionDate}-${shortId}.md`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- get() returns unknown
    const existing = getHash.get(destPath) as { content_hash: string; last_indexed: string } | undefined;
    if (existing && existing.content_hash === hash) {
      result.skipped++;
      return;
    }

    fs.writeFileSync(destPath, md, 'utf8');

    const category = isSubagent ? SUBAGENT_CATEGORY : SESSION_CATEGORY;

    deleteFts.run(destPath);
    insertFtsRow(db, {
      path: destPath,
      slug: `session-${sessionDate}-${shortId}`,
      description: `CC ${isSubagent ? 'subagent' : 'session'} transcript — ${slug} — ${sessionDate}`,
      type: 'raw',
      category,
      title: `${isSubagent ? 'Subagent' : 'Session'} ${sessionDate} — ${slug}`,
      content: md,
      tags: `${isSubagent ? 'subagent' : 'session'},${slug},transcript`,
      dateCaptured: sessionDate,
      project: slug,
    });

    upsertHash.run(destPath, hash, nowIso, category);
    result.synced++;
  });

  for (const session of sessions) {
    const slug = projectSlug(session.projectName);
    const shortId = sessionShortId(session.sessionId);

    try {
      const ageMs = now.getTime() - session.mtime.getTime();
      if (ageMs < ACTIVE_SESSION_THRESHOLD_MS) {
        result.skipped++;
        continue;
      }

      // mtime short-circuit: skip if source file hasn't changed since last sync
      const destDir = path.join(mindloreDir, 'raw', 'sessions', slug);
      const matchingFiles = fs.existsSync(destDir)
        ? fs.readdirSync(destDir).filter(f => f.includes(shortId))
        : [];
      const firstMatch = matchingFiles[0];
      if (firstMatch) {
        const existingPath = path.join(destDir, firstMatch);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- get() returns unknown
        const cached = getHash.get(existingPath) as { last_indexed: string } | undefined;
        if (cached && session.mtime <= new Date(cached.last_indexed)) {
          result.skipped++;
          continue;
        }
      }

      syncOne(session, slug, shortId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${shortId}: ${msg}`);
    }
  }

  db.close();
  return result;
}

// ── CLI ───────────────────────────────────────────────────────────────

const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) {
  const args = process.argv.slice(2);

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  }

  const claudeDir = getArg('--claude-dir') ?? path.join(os.homedir(), '.claude');
  const mindloreDir = getArg('--mindlore-dir') ?? GLOBAL_MINDLORE_DIR;
  const dbPath = getArg('--db') ?? path.join(mindloreDir, DB_NAME);

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
