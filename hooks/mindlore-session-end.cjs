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
const { execSync } = require('child_process');
const { findMindloreDir, globalDir, getProjectName, openDatabase, ensureEpisodesTable, insertBareEpisode, insertFtsRow } = require('./lib/mindlore-common.cjs');

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}${min}`;
}

function getRecentGitChanges() {
  try {
    const raw = execSync('git diff --name-only HEAD~5..HEAD 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).slice(0, 20);
  } catch (_err) {
    return [];
  }
}

function getRecentCommits() {
  try {
    const raw = execSync('git log --oneline -5 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean);
  } catch (_err) {
    return [];
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

  // Gather structured data
  const commits = getRecentCommits();
  const changedFiles = getRecentGitChanges();
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

  // v0.4.0: Write bare episode to episodes table
  writeBareEpisode(baseDir, project, commits, changedFiles, reads);

  // Git auto-commit + push for global ~/.mindlore/ only
  syncGlobalRepo();
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

    ensureEpisodesTable(db);

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

    const epId = insertBareEpisode(db, {
      kind: 'session',
      scope: 'project',
      project: project,
      summary: summary.slice(0, 300),
      body: bodyParts.join('\n\n') || null,
      tags: 'session',
      entities: entities.length > 0 ? entities : null,
      source: 'hook',
    });

    // FTS5 mirror — episode searchable via /mindlore-query and mindlore-search hook
    try {
      insertFtsRow(db, {
        path: `episodes/${epId}`,
        slug: `ep-${epId}`,
        description: summary.slice(0, 300),
        type: 'episode',
        category: 'episodes',
        title: summary.slice(0, 100),
        content: [summary, bodyParts.join('\n\n')].join('\n').trim(),
        tags: 'session',
        quality: null,
        dateCaptured: new Date().toISOString().slice(0, 10),
        project: project,
      });
    } catch (_ftsErr) {
      // FTS5 mirror is optional — don't break session end
    }

    db.close();
  } catch (_err) {
    // Graceful fail — never break session end
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

    execSync('git add -A', { cwd: gDir, timeout: 5000, stdio: 'pipe' });
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
