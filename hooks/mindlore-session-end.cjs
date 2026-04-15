#!/usr/bin/env node
'use strict';

/**
 * mindlore-session-end — SessionEnd hook
 *
 * Writes a basic delta file to diary/ with session timestamp.
 * v0.1: minimal delta (timestamp + marker)
 * v0.2: structured delta with stats, decisions, learnings
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const { findMindloreDir, globalDir, getProjectName, openDatabase, ensureEpisodesTable, hasEpisodesTable, insertBareEpisode, insertFtsRow, hookLog } = require('./lib/mindlore-common.cjs');

// --worker mode: heavy ops run in detached child process (survives parent exit)
if (process.argv.includes('--worker')) {
  hookLog('session-end', 'info', 'worker started, pid=' + process.pid);
  const dataPath = process.argv[process.argv.indexOf('--worker') + 1];
  let payload;
  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    fs.unlinkSync(dataPath); // cleanup temp file before any processing
    payload = JSON.parse(raw);
  } catch (_err) {
    hookLog('session-end', 'error', 'payload read failed: ' + (_err?.message ?? _err));
    process.exit(0);
  }
  const { baseDir, project, commits, changedFiles, reads } = payload;
  function safeRun(fn, label) {
    try { fn(); hookLog('session-end', 'info', label + ' OK'); }
    catch (e) { hookLog('session-end', 'error', label + ' FAIL: ' + e?.message); }
  }
  safeRun(() => writeBareEpisode(baseDir, project, commits, changedFiles, reads), 'episode');
  safeRun(() => writeEpisodeFile(baseDir, project, commits, changedFiles, reads), 'episode-file');
  safeRun(() => syncObsidian(baseDir), 'obsidian');
  safeRun(() => syncGlobalRepo(), 'git-sync');
  hookLog('session-end', 'info', 'worker done');
  process.exit(0);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}${min}`;
}

/**
 * Get recent commits and changed files in a single git call.
 * Returns { commits: string[], changedFiles: string[] }
 */
function getRecentGitInfo() {
  try {
    // --name-only includes file names after each commit entry
    const raw = execSync('git log --oneline -5 --name-only', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!raw) return { commits: [], changedFiles: [] };

    const commits = [];
    const fileSet = new Set();
    for (const line of raw.split('\n')) {
      if (!line) continue;
      // Commit lines start with a short hash (7+ hex chars)
      if (/^[0-9a-f]{7,}\s/.test(line)) {
        commits.push(line);
      } else {
        fileSet.add(line);
      }
    }
    return { commits, changedFiles: [...fileSet].slice(0, 20) };
  } catch (_err) {
    return { commits: [], changedFiles: [] };
  }
}

function getSessionReads(baseDir) {
  const readsPath = path.join(baseDir, 'diary', `_session-reads-${getProjectName()}.json`);
  if (!fs.existsSync(readsPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(readsPath, 'utf8'));
    const count = Object.keys(data).length;
    const repeats = Object.values(data).filter((v) => {
      if (typeof v === 'number') return v > 1;
      if (v && typeof v === 'object') return (v.count || 0) > 1;
      return false;
    }).length;
    // Clean up session file
    fs.unlinkSync(readsPath);
    return { count, repeats };
  } catch (_err) {
    return null;
  }
}

function main() {
  const baseDir = findMindloreDir();
  if (!baseDir) return;

  const diaryDir = path.join(baseDir, 'diary');
  if (!fs.existsSync(diaryDir)) {
    fs.mkdirSync(diaryDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = formatDate(now);
  const deltaPath = path.join(diaryDir, `delta-${dateStr}.md`);

  // Don't overwrite existing delta (idempotent)
  if (fs.existsSync(deltaPath)) return;

  // Gather structured data (single git call)
  const { commits, changedFiles } = getRecentGitInfo();
  const reads = getSessionReads(baseDir);

  const project = getProjectName();

  const sections = [
    '---',
    `slug: delta-${dateStr}`,
    'type: diary',
    `date: ${now.toISOString().slice(0, 10)}`,
    `project: ${project}`,
    '---',
    '',
    `# Session Delta — ${dateStr}`,
    '',
    `Session ended: ${now.toISOString()}`,
  ];

  // Commits section
  sections.push('', '## Commits');
  if (commits.length > 0) {
    for (const c of commits) sections.push(`- ${c}`);
  } else {
    sections.push('- _(no commits)_');
  }

  // Changed files section
  sections.push('', '## Changed Files');
  if (changedFiles.length > 0) {
    for (const f of changedFiles) sections.push(`- ${f}`);
  } else {
    sections.push('- _(no file changes)_');
  }

  // Read stats (from read-guard, if active)
  if (reads) {
    sections.push('', '## Read Stats');
    sections.push(`- ${reads.count} files read, ${reads.repeats} repeated reads`);
  }

  sections.push('');

  fs.writeFileSync(deltaPath, sections.join('\n'), 'utf8');

  // Append to log.md
  const logPath = path.join(baseDir, 'log.md');
  if (fs.existsSync(logPath)) {
    const logEntry = `| ${now.toISOString().slice(0, 10)} | session-end | delta-${dateStr}.md |\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
  }

  // Heavy ops: detach into child process so CC can exit immediately.
  // Fixes "Hook cancelled" when CC kills the hook before completion.
  // See: https://github.com/anthropics/claude-code/issues/41577
  try {
    const workerData = JSON.stringify({ baseDir, project, commits, changedFiles, reads });
    const tmpFile = path.join(os.tmpdir(), `mindlore-worker-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, workerData, 'utf8');
    // Use system node instead of process.execPath — CC's embedded Node
    // may not work as a standalone binary for detached worker processes.
    // Resolve full path to avoid shell:true deprecation warning on Windows.
    let nodeBin = 'node';
    if (process.platform === 'win32') {
      try { nodeBin = execSync('where node', { encoding: 'utf8', timeout: 3000 }).trim().split('\n')[0].trim(); } catch (_e) { nodeBin = 'node'; }
    }
    const child = spawn(nodeBin, [__filename, '--worker', tmpFile], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
    });
    child.unref();
  } catch (_err) {
    // Fallback: run inline if spawn fails
    writeBareEpisode(baseDir, project, commits, changedFiles, reads);
    writeEpisodeFile(baseDir, project, commits, changedFiles, reads);
    syncObsidian(baseDir);
    syncGlobalRepo();
  }
}

/**
 * Write a bare session episode to the episodes table.
 * Deterministic — no LLM needed. Captures commits, files, read stats.
 */
function writeBareEpisode(baseDir, project, commits, changedFiles, reads) {
  try {
    const dbPath = path.join(baseDir, 'mindlore.db');
    const db = openDatabase(dbPath);
    if (!db) return;

    if (!hasEpisodesTable(db)) {
      ensureEpisodesTable(db);
    }

    const commitList = commits.length > 0 ? commits.join(', ') : 'no commits';
    const fileCount = changedFiles.length;
    const summary = `Session: ${commitList} (${fileCount} files)`;

    const bodyParts = [];
    if (commits.length > 0) {
      bodyParts.push('## Commits\n' + commits.map(c => `- ${c}`).join('\n'));
    }
    if (changedFiles.length > 0) {
      bodyParts.push('## Changed Files\n' + changedFiles.map(f => `- ${f}`).join('\n'));
    }
    if (reads) {
      bodyParts.push(`## Read Stats\n- ${reads.count} files read, ${reads.repeats} repeated`);
    }

    const entities = changedFiles.slice(0, 10);
    const body = bodyParts.join('\n\n') || null;
    const truncatedSummary = summary.slice(0, 300);

    // Atomic: episode + FTS5 mirror in single transaction
    const writeBoth = db.transaction(() => {
      const epId = insertBareEpisode(db, {
        kind: 'session',
        scope: 'project',
        project: project,
        summary: truncatedSummary,
        body: body,
        tags: 'session',
        entities: entities.length > 0 ? entities : null,
        source: 'hook',
      });

      // FTS5 mirror — episode searchable via mindlore-search hook
      try {
        insertFtsRow(db, {
          path: `episodes/${epId}`,
          slug: `ep-${epId}`,
          description: truncatedSummary,
          type: 'episode',
          category: 'episodes',
          title: truncatedSummary,
          content: [truncatedSummary, body ?? ''].join('\n').trim(),
          tags: 'session',
          quality: null,
          dateCaptured: new Date().toISOString().slice(0, 10),
          project: project,
        });
      } catch (_ftsErr) {
        // FTS5 mirror optional — don't break the transaction
      }
    });
    writeBoth();

    db.close();
  } catch (err) {
    process.stderr.write(`[mindlore] episode write failed: ${err?.message ?? err}\n`);
  }
}

/**
 * Write episode as .md file to diary/{project}/ for human-readable browsing.
 * Complements the DB episode — same content, different medium.
 */
function writeEpisodeFile(baseDir, project, commits, changedFiles, reads) {
  const projDir = path.join(baseDir, 'diary', project || 'unknown');
  if (!fs.existsSync(projDir)) fs.mkdirSync(projDir, { recursive: true });

  const now = new Date();
  const ts = formatDate(now);
  const filePath = path.join(projDir, `episode-${ts}.md`);
  if (fs.existsSync(filePath)) return; // idempotent

  const lines = [
    '---',
    `slug: episode-${ts}`,
    'type: episode',
    `date: ${now.toISOString().slice(0, 10)}`,
    `project: ${project || 'unknown'}`,
    '---',
    '',
    `# Episode — ${ts}`,
    '',
  ];

  if (commits.length > 0) {
    lines.push('## Commits');
    for (const c of commits) lines.push(`- ${c}`);
    lines.push('');
  }

  if (changedFiles.length > 0) {
    lines.push('## Changed Files');
    for (const f of changedFiles) lines.push(`- ${f}`);
    lines.push('');
  }

  if (reads) {
    lines.push('## Read Stats');
    lines.push(`- ${reads.count} files read, ${reads.repeats} repeated`);
    lines.push('');
  }

  if (commits.length === 0 && changedFiles.length === 0) {
    lines.push('_Read-only session — no commits or file changes._');
    lines.push('');
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

const EXPORT_DIRS = ['analyses', 'decisions', 'diary', 'raw', 'sources', 'domains', 'connections', 'insights', 'learnings'];

/**
 * Load obsidian-helpers from compiled dist (single source of truth for wikilink conversion).
 * Returns null if helpers not available (e.g. dev environment without build).
 */
function loadObsidianHelpers() {
  try {
    // Resolve from package root (hooks/ is sibling to dist/)
    const hookDir = __dirname;
    const pkgRoot = path.dirname(hookDir);
    const helpersPath = path.join(pkgRoot, 'dist', 'scripts', 'lib', 'obsidian-helpers.js');
    if (!fs.existsSync(helpersPath)) return null;
    return require(helpersPath);
  } catch (_err) {
    return null;
  }
}

/**
 * Export a single .md file to Obsidian vault with wikilink conversion.
 * Uses obsidian-helpers.convertToWikilinks for consistent behavior.
 * Returns true if file was exported.
 */
function exportMdFile(srcPath, destPath, convertFn) {
  try {
    const destStat = fs.statSync(destPath);
    const srcStat = fs.statSync(srcPath);
    if (srcStat.mtimeMs <= destStat.mtimeMs) return false;
  } catch (_err) {
    // dest doesn't exist — proceed with export
  }
  let content = fs.readFileSync(srcPath, 'utf8');
  content = convertFn(content);
  fs.writeFileSync(destPath, content, 'utf8');
  return true;
}

/**
 * Auto-export .md files to Obsidian vault if configured.
 * Skips if no vault configured, vault missing, or nothing changed since last export.
 */
function syncObsidian(baseDir) {
  try {
    const configPath = path.join(baseDir, 'config.json');
    if (!fs.existsSync(configPath)) return;

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const vaultPath = config?.obsidian?.vault;
    if (!vaultPath || typeof vaultPath !== 'string') return;
    if (!fs.existsSync(vaultPath)) return;

    const helpers = loadObsidianHelpers();
    // Fallback regex if helpers unavailable (strips path prefixes like the canonical version)
    const convertFn = helpers?.convertToWikilinks
      ?? ((c) => c.replace(/\[([^\]]+)\]\((?:\.\.?\/)?(?:[\w-]+\/)*([^/)]+)\.md\)/g, '[[$2]]'));

    const destBase = path.join(vaultPath, 'mindlore');
    let exported = 0;

    for (const dir of EXPORT_DIRS) {
      const srcDir = path.join(baseDir, dir);
      if (!fs.existsSync(srcDir)) continue;

      const destDir = path.join(destBase, dir);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      for (const file of fs.readdirSync(srcDir).filter(f => f.endsWith('.md') && !f.startsWith('_'))) {
        if (exportMdFile(path.join(srcDir, file), path.join(destDir, file), convertFn)) exported++;
      }
    }

    for (const rootFile of ['INDEX.md', 'log.md']) {
      const srcPath = path.join(baseDir, rootFile);
      if (!fs.existsSync(srcPath)) continue;
      if (!fs.existsSync(destBase)) fs.mkdirSync(destBase, { recursive: true });
      if (exportMdFile(srcPath, path.join(destBase, rootFile), convertFn)) exported++;
    }

    if (exported > 0) {
      config.obsidian.lastExport = new Date().toISOString();
      config.obsidian.lastExportCount = exported;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
  } catch (err) {
    process.stderr.write(`[mindlore] obsidian sync failed: ${err?.message ?? err}\n`);
  }
}

/**
 * Auto-commit and push ~/.mindlore/ if it has a .git directory.
 * Only runs for the global scope — project .mindlore/ is in the project's own git.
 * Push failure is graceful (offline support).
 */
function syncGlobalRepo() {
  const gDir = globalDir();
  const gitDir = path.join(gDir, '.git');
  if (!fs.existsSync(gitDir)) return;

  try {
    // Check for changes
    const status = execSync('git status --porcelain', {
      cwd: gDir,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    if (!status) return; // nothing to commit

    execSync('git add *.md mindlore.db config.json diary/ sources/ domains/ analyses/ decisions/ raw/ connections/ insights/ learnings/', { cwd: gDir, timeout: 5000, stdio: 'pipe' });
    const now = new Date().toISOString().slice(0, 19);
    execSync(`git commit -m "mindlore auto-sync ${now}"`, {
      cwd: gDir,
      timeout: 10000,
      stdio: 'pipe',
    });

    // Push — graceful fail if no remote or offline
    try {
      execSync('git push', { cwd: gDir, timeout: 15000, stdio: 'pipe' });
    } catch (_pushErr) {
      // Offline or no remote — silently continue
    }
  } catch (_err) {
    // Git not available or commit failed — silently continue
  }
}

main();
