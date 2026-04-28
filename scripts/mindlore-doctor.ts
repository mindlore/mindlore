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

const FALLBACK_HOOKS = [
  'mindlore-session-focus', 'mindlore-search', 'mindlore-decision-detector',
  'mindlore-index', 'mindlore-fts5-sync', 'mindlore-session-end',
  'mindlore-pre-compact', 'mindlore-post-compact', 'mindlore-read-guard',
  'mindlore-post-read', 'mindlore-dont-repeat', 'mindlore-cwd-changed',
  'mindlore-model-router', 'mindlore-research-guard',
];

export function loadExpectedHooks(): string[] {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'plugin.json'),
    path.resolve(__dirname, '..', 'plugin.json'),
  ];
  const pluginPath = candidates.find(p => fs.existsSync(p));
  if (!pluginPath) return FALLBACK_HOOKS;
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
    if (isRecord(raw) && Array.isArray(raw.hooks)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- guarded by isRecord+Array.isArray above
      const hooks = raw.hooks as Array<Record<string, unknown>>;
      const names = hooks
        .map(h => typeof h.name === 'string' ? h.name : (typeof h.script === 'string' ? path.basename(h.script, '.cjs') : ''))
        .filter(Boolean);
      if (names.length > 0) return names;
    }
  } catch { /* fallback */ }
  return FALLBACK_HOOKS;
}

const EXPECTED_HOOKS = loadExpectedHooks();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function checkHooks(settings: Record<string, unknown>): CheckResult {
  const hooksRaw = settings?.hooks;
  if (!isRecord(hooksRaw)) return { name: 'Hooks', pass: false, message: 'No hooks configured', found: 0, expected: EXPECTED_HOOKS.length };

  const allCommands = new Set<string>();
  for (const val of Object.values(hooksRaw)) {
    // CC settings: hooks.EventName = [{matcher, hooks: [{type, command}]}] or direct array
    const topEntries = Array.isArray(val) ? val : [isRecord(val) ? val : {}];
    for (const top of topEntries) {
      const topObj = isRecord(top) ? top : {};
      const inner = topObj.hooks;
      const commandList = Array.isArray(inner) ? inner : [top];
      for (const e of commandList) {
        const eObj = isRecord(e) ? e : {};
        const cmd = typeof eObj.command === 'string' ? eObj.command : '';
        const match = cmd.match(/mindlore-[\w-]+/);
        if (match) allCommands.add(match[0]);
      }
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
  const major = parseInt(process.versions.node.split('.')[0] ?? '0', 10);
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
    const errMsg = err instanceof Error ? err.message : String(err);
    return { name: 'Database', pass: false, message: `DB error: ${errMsg}` };
  }
}

export function checkConfigVersion(baseDir: string, pkgVersion?: string): CheckResult {
  const configPath = path.join(baseDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    return { name: 'Config Version', pass: false, message: 'config.json not found' };
  }
  try {
    const configRaw: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const configVersion = isRecord(configRaw) && typeof configRaw.version === 'string' ? configRaw.version : undefined;
    let version = pkgVersion;
    if (!version) {
      // Try multiple paths — dist/scripts/ vs scripts/
      for (const rel of ['..', '../..']) {
        const p = path.join(__dirname, rel, 'package.json');
        if (fs.existsSync(p)) {
          const pkgRaw: unknown = JSON.parse(fs.readFileSync(p, 'utf8'));
          version = isRecord(pkgRaw) && typeof pkgRaw.version === 'string' ? pkgRaw.version : undefined;
          break;
        }
      }
    }
    const match = configVersion === version;
    return {
      name: 'Config Version',
      pass: match,
      message: match ? `${configVersion} (current)` : `${configVersion} != ${version ?? 'unknown'}`,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { name: 'Config Version', pass: false, message: errMsg };
  }
}

export function checkFtsTables(baseDir: string): CheckResult {
  const dbPath = path.join(baseDir, DB_NAME);
  if (!fs.existsSync(dbPath)) return { name: 'FTS Tables', pass: false, message: 'No DB' };

  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const tables: unknown[] = db.prepare(
      "SELECT name FROM sqlite_master WHERE (type IN ('table', 'shadow') AND name LIKE 'mindlore_%') OR name IN ('file_hashes', 'episodes', 'schema_versions')"
    ).all();
    db.close();

    const names = new Set<string>();
    for (const t of tables) {
      if (isRecord(t) && typeof t.name === 'string') names.add(t.name);
    }
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
    const errMsg = err instanceof Error ? err.message : String(err);
    return { name: 'FTS Tables', pass: false, message: errMsg };
  }
}

function resolvePackageDir(subdir: string): string | null {
  for (const rel of ['..', '../..']) {
    const p = path.join(__dirname, rel, subdir);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function checkSkills(): CheckResult {
  const skillsDir = resolvePackageDir('skills');
  if (!skillsDir) return { name: 'Skills', pass: false, message: 'skills/ not found', found: 0 };
  const skills = fs.readdirSync(skillsDir).filter(f => {
    const stat = fs.statSync(path.join(skillsDir, f));
    return stat.isDirectory() || f.endsWith('.md');
  });
  return {
    name: 'Skills',
    pass: skills.length >= 8,
    message: `${skills.length} skills found`,
    found: skills.length,
  };
}

export function checkAgents(): CheckResult {
  const agentsDir = resolvePackageDir('agents');
  if (!agentsDir) return { name: 'Agents', pass: true, message: 'No agents/ dir (optional)', found: 0 };
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
      const parsed: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (isRecord(parsed)) settings = parsed;
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
