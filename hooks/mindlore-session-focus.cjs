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
const { findMindloreDir, readConfig, openDatabase, hasEpisodesTable, querySupersededChains, formatSupersededChains, getAllMdFiles, hookLog, getProjectName, parseFrontmatter } = require('./lib/mindlore-common.cjs');

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

      if (diaryFiles.length > 0) {
        const sorted = [...diaryFiles].sort();
        const latestName = sorted[sorted.length - 1];
        const latestPath = path.join(diaryDir, latestName);
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

  // v0.5.4: Consolidated session payload (replaces scattered episodes/activity/alerts injection)
  try {
    const dbPath = path.join(baseDir, 'mindlore.db');
    const db = openDatabase(dbPath, { readonly: true });
    if (db) {
      try {
        // Session payload: Session summary, Decisions, Friction, Learnings
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

        // v0.4.1: Supersedes chain display (kept — not covered by session-payload)
        if (hasEpisodesTable(db)) {
          const project = path.basename(process.cwd());

          const chains = querySupersededChains(db, { project, days: 7, limit: 5 });
          if (chains.length > 0) {
            output.push(`[Mindlore Supersedes]\n${formatSupersededChains(chains)}`);
          }

          // v0.5.3: Episode consolidation reminder (kept — threshold-based reminder)
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

  hookLog('session-focus', 'info', 'session started');

  // Token budget for session inject
  // Defaults match DEFAULT_TOKEN_BUDGET in scripts/lib/constants.ts
  const budgetConfig = config?.tokenBudget ?? {};
  const maxInjectChars = (budgetConfig.sessionInject || 2000) * 4;

  let joined = output.join('\n\n');
  if (joined.length > maxInjectChars) {
    joined = joined.slice(0, maxInjectChars) + '\n[...truncated by token budget]';
  }

  // v0.5.5: Auto-start embedding daemon if not already running
  // Skip in test environments to avoid file lock issues
  if (process.env.NODE_ENV === 'test' || baseDir.includes('.test-')) {
    // no-op
  } else try {
    const os = require('os');
    const pidFile = path.join(baseDir, 'mindlore-daemon.pid');
    let daemonRunning = false;

    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      try {
        process.kill(pid, 0);
        daemonRunning = true;
      } catch {
        fs.unlinkSync(pidFile);
      }
    }

    if (!daemonRunning) {
      const daemonScript = path.join(__dirname, '..', 'dist', 'scripts', 'mindlore-daemon.js');
      if (fs.existsSync(daemonScript)) {
        const { spawn } = require('child_process');
        const child = spawn(process.execPath, [daemonScript, 'start'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.unref();
        hookLog('session-focus', 'info', 'Daemon auto-started, pid=' + child.pid);
      }
    }
  } catch (_err) {
    hookLog('session-focus', 'warn', 'Daemon auto-start failed: ' + (_err?.message || _err));
  }

  if (joined.length > 0) {
    process.stdout.write(joined + '\n');
  }
}

main();
