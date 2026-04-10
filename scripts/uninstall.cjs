#!/usr/bin/env node
'use strict';

/**
 * mindlore uninstall — Remove Mindlore hooks, skills, and optionally project data.
 *
 * Usage: npx mindlore uninstall [--all]
 *
 * --all: also remove .mindlore/ project data (without flag, only hooks + skills)
 */

const fs = require('fs');
const path = require('path');
const { homedir } = require('./lib/constants.cjs');

function log(msg) {
  console.log(`  ${msg}`);
}

// ── Remove hooks from settings.json ────────────────────────────────────

function removeHooks() {
  const settingsPath = path.join(homedir(), '.claude', 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    log('No settings.json found, skipping hooks');
    return 0;
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (_err) {
    log('Could not parse settings.json, skipping hooks');
    return 0;
  }

  if (!settings.hooks) return 0;

  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!Array.isArray(entries)) continue;

    const filtered = entries.filter((entry) => {
      const hooks = entry.hooks || [];
      const hasMindlore = hooks.some(
        (h) => (h.command || '').includes('mindlore-')
      );
      // Also check flat format (legacy)
      const flatMindlore = (entry.command || '').includes('mindlore-');

      if (hasMindlore || flatMindlore) {
        removed++;
        return false;
      }
      return true;
    });

    settings.hooks[event] = filtered;

    // Clean up empty arrays
    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event];
    }
  }

  if (removed > 0) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  return removed;
}

// ── Remove skills from ~/.claude/skills/ ───────────────────────────────

function removeSkills() {
  const skillsDir = path.join(homedir(), '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return 0;

  const mindloreSkills = fs
    .readdirSync(skillsDir)
    .filter((d) => d.startsWith('mindlore-'));

  let removed = 0;
  for (const skill of mindloreSkills) {
    const skillPath = path.join(skillsDir, skill);
    fs.rmSync(skillPath, { recursive: true, force: true });
    removed++;
  }

  return removed;
}

// ── Remove SCHEMA.md from projectDocFiles ──────────────────────────────

function removeFromProjectDocs() {
  const projectSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  if (!fs.existsSync(projectSettingsPath)) return false;

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf8'));
  } catch (_err) {
    return false;
  }

  if (!settings.projectDocFiles) return false;

  const before = settings.projectDocFiles.length;
  settings.projectDocFiles = settings.projectDocFiles.filter(
    (p) => !p.includes('mindlore')
  );

  if (settings.projectDocFiles.length < before) {
    fs.writeFileSync(
      projectSettingsPath,
      JSON.stringify(settings, null, 2),
      'utf8'
    );
    return true;
  }
  return false;
}

// ── Remove .mindlore/ project data ─────────────────────────────────────

function removeProjectData() {
  const mindloreDir = path.join(process.cwd(), '.mindlore');
  if (!fs.existsSync(mindloreDir)) {
    log('No .mindlore/ directory in current project');
    return false;
  }

  fs.rmSync(mindloreDir, { recursive: true, force: true });
  return true;
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const removeAll = args.includes('--all');

  console.log('\n  Mindlore — Uninstall\n');

  // Hooks
  const hooksRemoved = removeHooks();
  log(
    hooksRemoved > 0
      ? `Removed ${hooksRemoved} hooks from ~/.claude/settings.json`
      : 'No hooks found'
  );

  // Skills
  const skillsRemoved = removeSkills();
  log(
    skillsRemoved > 0
      ? `Removed ${skillsRemoved} skills from ~/.claude/skills/`
      : 'No skills found'
  );

  // Project doc files
  const docsRemoved = removeFromProjectDocs();
  log(
    docsRemoved
      ? 'Removed SCHEMA.md from project settings'
      : 'No project doc references found'
  );

  // Project data (only with --all)
  if (removeAll) {
    const dataRemoved = removeProjectData();
    log(
      dataRemoved
        ? 'Removed .mindlore/ project data'
        : 'No .mindlore/ directory found'
    );
  } else {
    log('.mindlore/ project data kept (use --all to remove)');
  }

  console.log('\n  Done! Mindlore has been uninstalled.\n');
}

main();
