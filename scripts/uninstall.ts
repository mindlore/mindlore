#!/usr/bin/env node

/**
 * mindlore uninstall — Remove Mindlore hooks, skills, and optionally global data.
 *
 * Usage: npx mindlore uninstall [--all]
 *
 * --all: also remove ~/.mindlore/ global data (without flag, only hooks + skills)
 * v0.3.3: Global-first — only ~/.mindlore/ exists, no project scope.
 */

import fs from 'fs';
import path from 'path';
import { homedir, log, GLOBAL_MINDLORE_DIR } from './lib/constants.js';
import type { Settings } from './lib/constants.js';
import { safeWriteJson } from './lib/secure-io.js';
import { cleanupLegacyHooks } from './lib/settings-cleanup.js';
import { readJsonFile } from './lib/safe-parse.js';

// ── Remove hooks from settings.json ────────────────────────────────────

function removeHooks(): number {
  const settingsPath = path.join(homedir(), '.claude', 'settings.json');
  const result = cleanupLegacyHooks(settingsPath);
  return result.removed;
}

// ── Remove skills from ~/.claude/skills/ ───────────────────────────────

function removeSkills(): number {
  const skillsDir = path.join(homedir(), '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return 0;

  // Only remove skills registered in plugin.json — don't wildcard delete user's custom skills
  const packageRoot = path.resolve(__dirname, '..');
  const pluginPath = path.join(packageRoot, 'plugin.json');
  const registeredSkills: string[] = [];
  if (fs.existsSync(pluginPath)) {
    const plugin = readJsonFile<{ skills?: Array<{ name?: string }> }>(pluginPath);
    for (const s of plugin.skills ?? []) {
      if (s.name) registeredSkills.push(s.name);
    }
  }

  let removed = 0;
  for (const skill of registeredSkills) {
    const skillPath = path.join(skillsDir, skill);
    if (fs.existsSync(skillPath)) {
      fs.rmSync(skillPath, { recursive: true, force: true });
      removed++;
    }
  }

  // Also remove orphan agents from ~/.claude/agents/
  const agentsDir = path.join(homedir(), '.claude', 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const file of fs.readdirSync(agentsDir)) {
      if (file.startsWith('mindlore-')) {
        const agentPath = path.join(agentsDir, file);
        fs.rmSync(agentPath, { recursive: true, force: true });
        removed++;
      }
    }
  }

  return removed;
}

// ── Remove SCHEMA.md from projectDocFiles ──────────────────────────────

function removeFromProjectDocs(): boolean {
  const projectSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  if (!fs.existsSync(projectSettingsPath)) return false;

  let settings: Settings;
  try {
    settings = readJsonFile<Settings>(projectSettingsPath);
  } catch (_err) {
    return false;
  }

  if (!settings.projectDocFiles) return false;

  const before = settings.projectDocFiles.length;
  settings.projectDocFiles = settings.projectDocFiles.filter(
    (p) => !p.includes('mindlore'),
  );

  if (settings.projectDocFiles.length < before) {
    safeWriteJson(projectSettingsPath, settings);
    return true;
  }
  return false;
}

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const removeAll = args.includes('--all');

  console.log(`\n  Mindlore — Uninstall [global (~/.mindlore/)]\n`);

  // Hooks
  const hooksRemoved = removeHooks();
  log(
    hooksRemoved > 0
      ? `Removed ${hooksRemoved} hooks from ~/.claude/settings.json`
      : 'No hooks found',
  );

  // Skills
  const skillsRemoved = removeSkills();
  log(
    skillsRemoved > 0
      ? `Removed ${skillsRemoved} skills from ~/.claude/skills/`
      : 'No skills found',
  );

  // Project doc files
  const docsRemoved = removeFromProjectDocs();
  log(
    docsRemoved
      ? 'Removed SCHEMA.md from project settings'
      : 'No project doc references found',
  );

  // Data removal (only with --all)
  if (removeAll) {
    if (fs.existsSync(GLOBAL_MINDLORE_DIR)) {
      fs.rmSync(GLOBAL_MINDLORE_DIR, { recursive: true, force: true });
      log('Removed ~/.mindlore/ global data');
    } else {
      log('No ~/.mindlore/ directory found');
    }
  } else {
    log('~/.mindlore/ data kept (use --all to remove)');
  }

  console.log('\n  Done! Mindlore has been uninstalled.\n');
}

main();
