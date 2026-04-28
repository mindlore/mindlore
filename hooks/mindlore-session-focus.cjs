#!/usr/bin/env node
'use strict';

/**
 * mindlore-session-focus — SessionStart hook
 *
 * Injects last delta file content + INDEX.md into session context.
 * Fires once at session start via stdout additionalContext.
 */

const fs = require('fs');
const path = require('path');
const { findMindloreDir, readConfig, openDatabase, hasEpisodesTable, querySupersededChains, formatSupersededChains, hookLog, getProjectName, parseFrontmatter, withTelemetry, withTimeoutDb } = require('./lib/mindlore-common.cjs');

function main() {
  const t0 = Date.now();
  const baseDir = findMindloreDir();
  if (!baseDir) return; // No .mindlore/ found, silently skip

  const output = [];
  const config = readConfig(baseDir);
  const timings = {};
  let sourceChars = 0;

  // Inject INDEX.md
  const tIndex = Date.now();
  const indexPath = path.join(baseDir, 'INDEX.md');
  if (fs.existsSync(indexPath)) {
    sourceChars += fs.statSync(indexPath).size;
    const content = fs.readFileSync(indexPath, 'utf8').trim();
    output.push(`[Mindlore INDEX]\n${content}`);
  }
  timings.index_read = Date.now() - tIndex;

  // Inject latest delta + reflect trigger (single readdirSync)
  const tDiary = Date.now();
  const diaryDir = path.join(baseDir, 'diary');
  if (fs.existsSync(diaryDir)) {
    try {
      const diaryFiles = fs.readdirSync(diaryDir).filter(f => f.startsWith('delta-') && f.endsWith('.md'));

      if (diaryFiles.length > 0) {
        const sorted = [...diaryFiles].sort();
        const latestName = sorted[sorted.length - 1];
        const latestPath = path.join(diaryDir, latestName);
        sourceChars += fs.statSync(latestPath).size;
        const deltaContent = fs.readFileSync(latestPath, 'utf8').trim();
        const { meta } = parseFrontmatter(deltaContent);
        const deltaProject = meta.project || null;
        const currentProject = getProjectName();
        if (!deltaProject || deltaProject.toLowerCase() === currentProject.toLowerCase()) {
          output.push(`[Mindlore Delta: ${latestName}]\n${deltaContent}`);
        }
      }

      // Reflect trigger
      const threshold = config?.reflect?.threshold ?? 5;
      if (diaryFiles.length >= threshold) {
        output.push(`[Mindlore] ${diaryFiles.length} diary entry birikti — \`/mindlore-log reflect\` calistirmayi dusun.`);
      }
    } catch (_err) { /* skip */ }
  }
  timings.diary_walk = Date.now() - tDiary;

  // Version check: compare .version (installed) vs .pkg-version (package)
  const tVersion = Date.now();
  // Both are flat strings written by init — no JSON parse needed on session start
  const versionPath = path.join(baseDir, '.version');
  const pkgVersionPath = path.join(baseDir, '.pkg-version');
  try {
    if (fs.existsSync(versionPath) && fs.existsSync(pkgVersionPath)) {
      const installed = fs.readFileSync(versionPath, 'utf8').trim();
      const pkgVersion = fs.readFileSync(pkgVersionPath, 'utf8').trim();
      if (pkgVersion && pkgVersion !== installed) {
        output.push(`[Mindlore: Guncelleme mevcut (${installed} → ${pkgVersion}). \`npx mindlore init\` calistirin.]`);
      }
    }
  } catch (_err) { /* skip */ }
  timings.version_check = Date.now() - tVersion;

  // v0.5.4: Consolidated session payload (replaces scattered episodes/activity/alerts injection)
  const tDb = Date.now();
  const outputLenBeforeDb = output.reduce((s, o) => s + o.length, 0);
  try {
    const dbPath = path.join(baseDir, 'mindlore.db');
    const tDbOpen = Date.now();
    const db = openDatabase(dbPath, { readonly: true });
    timings.db_open = Date.now() - tDbOpen;

    if (db) {
      // v0.6.2: Lazy integrity — recover only on SQLITE_CORRUPT (was: pragma integrity_check every session, ~2200ms)
      const recoverCorruptDb = (reason) => {
        try { db.close(); } catch { /* already closed */ }
        const bakPath = dbPath + '.corrupt.bak';
        try { fs.copyFileSync(dbPath, bakPath); } catch { /* best effort */ }
        try { fs.unlinkSync(dbPath); } catch { /* best effort */ }
        hookLog('session-focus', 'warn', reason);
      };
      const isCorruptionError = (err) => {
        const code = err?.code ?? '';
        const msg = String(err?.message ?? err);
        return code === 'SQLITE_CORRUPT' || code === 'SQLITE_NOTADB' || /corrupt|malformed/i.test(msg);
      };
      timings.db_integrity = 0;
      try {
        // Session payload: Session summary, Decisions, Friction, Learnings
        const tPayload = Date.now();
        try {
          const { buildSessionPayload } = require('../dist/scripts/lib/session-payload.js');
          const project = path.basename(process.cwd());
          const payloadBudget = config?.tokenBudget?.sessionInject ?? 2000;
          const payload = buildSessionPayload(db, baseDir, project, payloadBudget);
          if (!payload.skipInjection) {
            for (const section of payload.sections) {
              output.push(`[Mindlore ${section.label}]\n${section.content}`);
            }
          }
        } catch (_payloadErr) {
          // Session payload is optional — don't break session start
        }
        timings.db_payload = Date.now() - tPayload;

        // v0.4.1: Supersedes chain display (kept — not covered by session-payload)
        const tSuperseded = Date.now();
        if (hasEpisodesTable(db)) {
          const project = path.basename(process.cwd());

          const chains = querySupersededChains(db, { project, days: 7, limit: 5 });
          if (chains.length > 0) {
            output.push(`[Mindlore Supersedes]\n${formatSupersededChains(chains)}`);
          }

          // v0.5.3: Episode consolidation reminder (kept — threshold-based reminder)
          try {
            const rawCount = withTimeoutDb(db,
              "SELECT COUNT(*) as cnt FROM episodes WHERE consolidation_status = 'raw' OR consolidation_status IS NULL",
              [], { mode: 'get' });
            const cnt = rawCount?.cnt ?? 0;
            const consolThreshold = config?.consolidation?.threshold ?? 50;
            if (cnt >= consolThreshold) {
              output.push(`[Mindlore] ${cnt} raw episode birikti — \`/mindlore-maintain consolidate\` ile birleştirmeyi düşün.`);
            }
          } catch (_err) { /* consolidation_status column may not exist yet */ }
        }
        timings.db_episodes = Date.now() - tSuperseded;

        // v0.5.5: Stale content check (reuses open DB handle)
        const tStale = Date.now();
        try {
          const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
          const row = withTimeoutDb(db, 'SELECT COUNT(*) as cnt FROM file_hashes WHERE last_indexed < ?', [thirtyDaysAgo], { mode: 'get' });
          const staleCount = row?.cnt ?? 0;
          if (staleCount > 3) {
            output.push(`[Mindlore: ${staleCount} dosya 30+ gundur guncellenmemis — \`/mindlore-evolve\` dusun]`);
          }
        } catch (_staleErr) { /* file_hashes may not exist */ }
        timings.db_stale = Date.now() - tStale;
      } catch (err) {
        if (isCorruptionError(err)) {
          recoverCorruptDb(`Corrupt DB detected during query: ${err?.message ?? err}`);
        }
      } finally {
        try { db.close(); } catch { /* already closed by recovery */ }
      }
    }
  } catch (_err) { /* graceful skip */ }
  const outputLenAfterDb = output.reduce((s, o) => s + o.length, 0);
  sourceChars += (outputLenAfterDb - outputLenBeforeDb);
  timings.db_total = Date.now() - tDb;

  timings.total = Date.now() - t0;
  hookLog('session-focus', 'info', `timings: ${JSON.stringify(timings)}`);

  // Token budget for session inject
  // Defaults match DEFAULT_TOKEN_BUDGET in scripts/lib/constants.ts
  const budgetConfig = config?.tokenBudget ?? {};
  const maxInjectChars = (budgetConfig.sessionInject || 2000) * 4;

  let joined = output.join('\n\n');
  if (joined.length > maxInjectChars) {
    joined = joined.slice(0, maxInjectChars) + '\n[...truncated by token budget]';
  }

  // v0.6.1: Daemon auto-start removed (daemon deprecated — MCP Server in v0.7)

  if (joined.length > 0) {
    process.stdout.write(joined + '\n');
  }

  const inject_tokens = Math.ceil(joined.length / 4);
  const source_tokens = Math.ceil(sourceChars / 4);
  return { inject_tokens, source_tokens };
}

withTelemetry('mindlore-session-focus', main).catch(err => {
  hookLog('mindlore-session-focus', 'error', err?.message ?? String(err));
  process.exit(0);
});
