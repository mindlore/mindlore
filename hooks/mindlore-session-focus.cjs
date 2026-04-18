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
const { findMindloreDir, readConfig, openDatabase, hasEpisodesTable, queryRecentEpisodes, querySupersededChains, formatSupersededChains, queryMultiSessionEpisodes, formatMultiSessionEpisodes, getAllMdFiles, getRecentHookErrors, hookLog } = require('./lib/mindlore-common.cjs');

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return; // No .mindlore/ found, silently skip

  const output = [];
  const config = readConfig(baseDir);

  // Inject INDEX.md
  const indexPath = path.join(baseDir, 'INDEX.md');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8').trim();
    output.push(`[Mindlore INDEX]\n${content}`);
  }

  // Inject latest delta + reflect trigger (single readdirSync)
  const diaryDir = path.join(baseDir, 'diary');
  if (fs.existsSync(diaryDir)) {
    try {
      const diaryFiles = fs.readdirSync(diaryDir).filter(f => f.startsWith('delta-') && f.endsWith('.md'));

      // Latest delta
      if (diaryFiles.length > 0) {
        const sorted = [...diaryFiles].sort();
        const latestName = sorted[sorted.length - 1];
        const latestPath = path.join(diaryDir, latestName);
        const deltaContent = fs.readFileSync(latestPath, 'utf8').trim();
        output.push(`[Mindlore Delta: ${latestName}]\n${deltaContent}`);
      }

      // Reflect trigger
      const threshold = config?.reflect?.threshold ?? 5;
      if (diaryFiles.length >= threshold) {
        output.push(`[Mindlore] ${diaryFiles.length} diary entry birikti — \`/mindlore-log reflect\` calistirmayi dusun.`);
      }
    } catch (_err) { /* skip */ }
  }

  // Version check: compare .version (installed) vs .pkg-version (package)
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

  // v0.4.0: Inject recent episodes
  try {
    const dbPath = path.join(baseDir, 'mindlore.db');
    const db = openDatabase(dbPath, { readonly: true });
    if (db) {
      try {
        if (hasEpisodesTable(db)) {
          const maxEpisodes = config?.session_focus?.max_episodes ?? 3;
          const project = path.basename(process.cwd());
          const episodes = queryRecentEpisodes(db, { project, limit: maxEpisodes });

          if (episodes.length > 0) {
            const lines = episodes.map(ep => {
              const date = (ep.created_at || '').slice(0, 10);
              const summary = String(ep.summary || '').slice(0, 100);
              return `- [${date}] ${ep.kind}: ${summary}`;
            });
            output.push(`[Mindlore Episodes]\n${lines.join('\n')}`);
          }

          // v0.4.1: Enriched multi-session episodes
          const multiDays = config?.session_focus?.multi_session_days ?? 3;
          const enriched = queryMultiSessionEpisodes(db, { project, days: multiDays, limit: 20 });
          if (enriched.length > 0) {
            const formatted = formatMultiSessionEpisodes(enriched);
            if (formatted) {
              output.push(`[Mindlore Recent Activity]\n${formatted}`);
            }
          }

          // v0.4.1: Supersedes chain display
          const chains = querySupersededChains(db, { project, days: 7, limit: 5 });
          if (chains.length > 0) {
            output.push(`[Mindlore Supersedes]\n${formatSupersededChains(chains)}`);
          }

          // v0.5.3: Episode consolidation reminder
          try {
            const rawCount = db.prepare(
              "SELECT COUNT(*) as cnt FROM episodes WHERE consolidation_status = 'raw' OR consolidation_status IS NULL"
            ).get();
            const cnt = rawCount?.cnt ?? 0;
            const consolThreshold = config?.consolidation?.threshold ?? 50;
            if (cnt >= consolThreshold) {
              output.push(`[Mindlore] ${cnt} raw episode birikti — \`/mindlore-maintain consolidate\` ile birleştirmeyi düşün.`);
            }
          } catch (_err) { /* consolidation_status column may not exist yet */ }
        }
      } finally {
        db.close();
      }
    }
  } catch (_err) { /* graceful skip */ }

  // v0.4.1: Lightweight stale content check (monitors fallback)
  try {
    const allFiles = getAllMdFiles(baseDir);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const staleCount = allFiles.reduce((count, f) => {
      try { return fs.statSync(f).mtimeMs < thirtyDaysAgo ? count + 1 : count; } catch { return count; }
    }, 0);
    if (staleCount > 3) {
      output.push(`[Mindlore: ${staleCount} dosya 30+ gundur guncellenmemis — \`/mindlore-evolve\` dusun]`);
    }
  } catch (_healthErr) { /* skip */ }

  // Check for recent hook errors — inject warnings into CC context
  try {
    const errors = getRecentHookErrors();
    if (errors.length > 0) {
      const lines = errors.map(e => `- [${e.ts.slice(0, 19)}] **${e.hook}** (${e.level}): ${e.msg}`);
      output.push(`[Mindlore Hook Alerts]\n${lines.join('\n')}`);
    }
  } catch (_hookLogErr) { /* skip */ }

  hookLog('session-focus', 'info', 'session started');

  // Token budget for session inject
  // Defaults match DEFAULT_TOKEN_BUDGET in scripts/lib/constants.ts
  const budgetConfig = config?.tokenBudget ?? {};
  const maxInjectChars = (budgetConfig.sessionInject || 2000) * 4;

  let joined = output.join('\n\n');
  if (joined.length > maxInjectChars) {
    joined = joined.slice(0, maxInjectChars) + '\n[...truncated by token budget]';
  }

  if (joined.length > 0) {
    process.stdout.write(joined + '\n');
  }
}

main();
