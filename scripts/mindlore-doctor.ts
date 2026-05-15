#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { GLOBAL_MINDLORE_DIR, DB_NAME } from './lib/constants.js';
import { errMsg } from './lib/err-msg.js';
import { readJsonFile } from './lib/safe-parse.js';

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
    const raw = readJsonFile<Record<string, unknown>>(pluginPath);
    if (Array.isArray(raw.hooks)) {
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

export function checkHooks(): CheckResult {
  // Validates plugin.json has all expected hooks defined (source-of-truth for both npx and plugin paths)
  const found = EXPECTED_HOOKS.length;
  if (found === 0) {
    return { name: 'Hooks', pass: false, message: 'plugin.json not found or has no hooks', found: 0, expected: 14 };
  }
  return {
    name: 'Hooks',
    pass: true,
    message: `${found}/${found} hooks in plugin.json (auto-discovery)`,
    found,
    expected: found,
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
    return { name: 'Database', pass: false, message: `DB error: ${errMsg(err)}` };
  }
}

export function checkConfigVersion(baseDir: string, pkgVersion?: string): CheckResult {
  const configPath = path.join(baseDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    return { name: 'Config Version', pass: false, message: 'config.json not found' };
  }
  try {
    const configRaw = readJsonFile<Record<string, unknown>>(configPath);
    const configVersion = typeof configRaw.version === 'string' ? configRaw.version : undefined;
    let version = pkgVersion;
    if (!version) {
      // Try multiple paths — dist/scripts/ vs scripts/
      for (const rel of ['..', '../..']) {
        const p = path.join(__dirname, rel, 'package.json');
        if (fs.existsSync(p)) {
          const pkgRaw = readJsonFile<{ version?: string }>(p);
          version = typeof pkgRaw.version === 'string' ? pkgRaw.version : undefined;
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
    return { name: 'Config Version', pass: false, message: errMsg(err) };
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
    return { name: 'FTS Tables', pass: false, message: errMsg(err) };
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

export function checkStaleLocalDb(cwd: string): CheckResult {
  const localDb = path.join(cwd, '.mindlore', 'mindlore.db');
  if (!fs.existsSync(localDb)) {
    return { name: 'Stale Local DB', pass: true, message: 'No local .mindlore/ DB' };
  }

  try {
    const Database = require('better-sqlite3');
    const db = new Database(localDb, { readonly: true });
    const sv = db.prepare("SELECT name FROM sqlite_master WHERE name='mindlore_schema_version'").get();
    db.close();

    if (!sv) {
      return {
        name: 'Stale Local DB',
        pass: false,
        message: `Stale local .mindlore/mindlore.db found in ${cwd} — pre-v0.6.0 schema, no schema_version table. Global DB (~/.mindlore/) should be used. Delete local DB: rm ${localDb}`,
      };
    }
    return { name: 'Stale Local DB', pass: true, message: 'Local .mindlore/ DB exists with schema_version' };
  } catch {
    return { name: 'Stale Local DB', pass: false, message: `Local .mindlore/mindlore.db exists but unreadable: ${localDb}` };
  }
}

export function checkStalePluginCache(): CheckResult {
  const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'mindlore', 'mindlore');
  if (!fs.existsSync(cacheDir)) return { name: 'Plugin Cache', pass: true, message: 'No plugin cache found' };

  try {
    const versions = fs.readdirSync(cacheDir).filter(d => {
      return fs.statSync(path.join(cacheDir, d)).isDirectory();
    });
    if (versions.length <= 1) return { name: 'Plugin Cache', pass: true, message: `Plugin cache: ${versions[0] ?? 'none'}` };

    const sorted = versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const latest = sorted[sorted.length - 1];
    const stale = sorted.slice(0, -1);

    return {
      name: 'Plugin Cache',
      pass: false,
      message: `Stale plugin cache: ${stale.join(', ')} (latest: ${latest}). Remove: ${stale.map(v => path.join(cacheDir, v)).join(', ')} — Run: npx mindlore clean-cache`,
    };
  } catch {
    return { name: 'Plugin Cache', pass: true, message: 'Plugin cache check skipped' };
  }
}

export function checkStaleTempDirs(): CheckResult {
  const cacheRoot = path.join(os.homedir(), '.claude', 'plugins', 'cache');
  if (!fs.existsSync(cacheRoot)) return { name: 'Stale Temp Dirs', pass: true, message: 'No plugin cache root' };

  try {
    const tempDirs = fs.readdirSync(cacheRoot).filter(d => d.startsWith('temp_npm_'));
    if (tempDirs.length === 0) return { name: 'Stale Temp Dirs', pass: true, message: 'No stale temp dirs' };

    return {
      name: 'Stale Temp Dirs',
      pass: false,
      message: `${tempDirs.length} stale temp_npm_* dirs in plugin cache. Remove: ${tempDirs.map(d => path.join(cacheRoot, d)).join(', ')}`,
    };
  } catch {
    return { name: 'Stale Temp Dirs', pass: true, message: 'Temp dir check skipped' };
  }
}

function main(): void {
  const baseDir = process.env.MINDLORE_HOME ?? GLOBAL_MINDLORE_DIR;

  const checks = [
    checkNodeVersion(),
    checkDatabase(baseDir),
    checkConfigVersion(baseDir),
    checkFtsTables(baseDir),
    checkHooks(),
    checkSkills(),
    checkAgents(),
    checkStaleLocalDb(process.cwd()),
    checkStalePluginCache(),
    checkStaleTempDirs(),
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
