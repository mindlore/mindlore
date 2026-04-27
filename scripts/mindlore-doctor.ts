#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { GLOBAL_MINDLORE_DIR, DB_NAME } from './lib/constants.js';

interface CheckResult {
  name: string;
  pass: boolean;
  message: string;
  found?: number;
  expected?: number;
}

const EXPECTED_HOOKS = [
  'mindlore-session-focus', 'mindlore-search', 'mindlore-decision-detector',
  'mindlore-index', 'mindlore-fts5-sync', 'mindlore-session-end',
  'mindlore-pre-compact', 'mindlore-post-compact', 'mindlore-read-guard',
  'mindlore-post-read', 'mindlore-dont-repeat', 'mindlore-cwd-changed',
  'mindlore-model-router', 'mindlore-research-guard',
];

export function checkHooks(settings: Record<string, unknown>): CheckResult {
  const hooks = settings?.hooks as Record<string, unknown[]> | undefined;
  if (!hooks) return { name: 'Hooks', pass: false, message: 'No hooks configured', found: 0, expected: EXPECTED_HOOKS.length };

  const allCommands = new Set<string>();
  for (const entries of Object.values(hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const cmd = (e as Record<string, string>)?.command ?? '';
      if (cmd.includes('mindlore-')) allCommands.add(cmd.replace(/^.*[/\\]/, '').replace(/\.cjs$/, ''));
    }
  }

  const found = EXPECTED_HOOKS.filter(h => allCommands.has(h)).length;
  return {
    name: 'Hooks',
    pass: found >= EXPECTED_HOOKS.length,
    message: `${found}/${EXPECTED_HOOKS.length} hooks registered`,
    found,
    expected: EXPECTED_HOOKS.length,
  };
}

export function checkNodeVersion(): CheckResult {
  const major = parseInt(process.versions.node.split('.')[0]!, 10);
  return {
    name: 'Node.js',
    pass: major >= 18,
    message: `Node ${process.versions.node} (min 18)`,
  };
}

export function checkDatabase(baseDir: string): CheckResult {
  const dbPath = path.join(baseDir, DB_NAME);
  if (!fs.existsSync(dbPath)) {
    return { name: 'Database', pass: false, message: 'mindlore.db not found' };
  }
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const check = db.pragma('integrity_check(1)');
    const result = Array.isArray(check) ? check[0]?.integrity_check : check;
    db.close();
    return {
      name: 'Database',
      pass: result === 'ok',
      message: result === 'ok' ? 'Integrity OK' : `Integrity: ${result}`,
    };
  } catch (err) {
    return { name: 'Database', pass: false, message: `DB error: ${(err as Error).message}` };
  }
}

export function checkConfigVersion(baseDir: string, pkgVersion?: string): CheckResult {
  const configPath = path.join(baseDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    return { name: 'Config Version', pass: false, message: 'config.json not found' };
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { version?: string };
    let version = pkgVersion;
    if (!version) {
      // Try multiple paths — dist/scripts/ vs scripts/
      for (const rel of ['..', '../..']) {
        const p = path.join(__dirname, rel, 'package.json');
        if (fs.existsSync(p)) {
          version = (JSON.parse(fs.readFileSync(p, 'utf8')) as { version: string }).version;
          break;
        }
      }
    }
    const match = config.version === version;
    return {
      name: 'Config Version',
      pass: match,
      message: match ? `${config.version} (current)` : `${config.version} != ${version ?? 'unknown'}`,
    };
  } catch (err) {
    return { name: 'Config Version', pass: false, message: (err as Error).message };
  }
}

export function checkFtsTables(baseDir: string): CheckResult {
  const dbPath = path.join(baseDir, DB_NAME);
  if (!fs.existsSync(dbPath)) return { name: 'FTS Tables', pass: false, message: 'No DB' };

  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'shadow') AND name LIKE 'mindlore_%' OR name = 'file_hashes' OR name = 'episodes' OR name = 'schema_versions'"
    ).all() as Array<{ name: string }>;
    db.close();

    const names = new Set(tables.map((t: { name: string }) => t.name));
    const required = ['mindlore_fts', 'file_hashes', 'schema_versions'];
    const missing = required.filter(t => !names.has(t));
    const hasSessions = names.has('mindlore_fts_sessions');

    return {
      name: 'FTS Tables',
      pass: missing.length === 0,
      message: missing.length === 0
        ? `Core tables OK${hasSessions ? ' + sessions' : ''}`
        : `Missing: ${missing.join(', ')}`,
    };
  } catch (err) {
    return { name: 'FTS Tables', pass: false, message: (err as Error).message };
  }
}

export function checkSkills(): CheckResult {
  const skillsDir = path.join(__dirname, '..', 'skills');
  if (!fs.existsSync(skillsDir)) return { name: 'Skills', pass: false, message: 'skills/ not found', found: 0 };
  const skills = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
  return {
    name: 'Skills',
    pass: skills.length >= 8,
    message: `${skills.length} skills found`,
    found: skills.length,
  };
}

export function checkAgents(): CheckResult {
  const agentsDir = path.join(__dirname, '..', 'agents');
  if (!fs.existsSync(agentsDir)) return { name: 'Agents', pass: true, message: 'No agents/ dir (optional)', found: 0 };
  const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  return {
    name: 'Agents',
    pass: true,
    message: `${agents.length} agents found`,
    found: agents.length,
  };
}

function main(): void {
  const baseDir = process.env.MINDLORE_HOME ?? GLOBAL_MINDLORE_DIR;

  let settings: Record<string, unknown> = {};
  try {
    const settingsPath = path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    }
  } catch { /* skip */ }

  const checks = [
    checkNodeVersion(),
    checkDatabase(baseDir),
    checkConfigVersion(baseDir),
    checkFtsTables(baseDir),
    checkHooks(settings),
    checkSkills(),
    checkAgents(),
  ];

  console.log('\nMindlore Doctor\n' + '='.repeat(30));
  let passed = 0;
  for (const c of checks) {
    const icon = c.pass ? '[+]' : '[-]';
    console.log(`  ${icon} ${c.name}: ${c.message}`);
    if (c.pass) passed++;
  }
  console.log(`\n  ${passed}/${checks.length} checks passed\n`);

  process.exit(passed === checks.length ? 0 : 1);
}

if (require.main === module) main();
