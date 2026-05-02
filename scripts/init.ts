#!/usr/bin/env node

/**
 * mindlore init — Initialize ~/.mindlore/ global knowledge base.
 *
 * Usage: npx mindlore init [--recommended]
 *
 * v0.3.3: Global-first — single ~/.mindlore/ directory, project namespace via CWD basename.
 * --global flag kept for backward compat (no-op, always global).
 * Idempotent: running again does not destroy existing data.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { MINDLORE_DIR, GLOBAL_MINDLORE_DIR, DB_NAME, DIRECTORIES, CONFIG_FILE, DEFAULT_MODELS, homedir, log, resolveHookCommon } from './lib/constants.js';
import type { Settings } from './lib/constants.js';
import { dbPragma } from './lib/db-helpers.js';
import { mergeDefaults } from './lib/merge-defaults.js';
import { parseJsonObject, readJsonFile } from './lib/safe-parse.js';
import { ensureSchemaTable, runMigrations } from './lib/schema-version.js';
import { INIT_MIGRATIONS } from './lib/all-migrations.js';

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- dynamic CJS require, typed by mindlore-common.d.cts
const { SQL_FTS_CREATE, ensureEpisodesTable: ensureEpisodesTableCjs } = require(resolveHookCommon(__dirname)) as {
  SQL_FTS_CREATE: string;
  ensureEpisodesTable: (db: import('better-sqlite3').Database) => void;
};

const TEMPLATE_FILES = ['INDEX.md', 'log.md'];

interface PluginHook {
  event: string;
  script: string;
}

interface PluginSkill {
  name: string;
  path: string;
}

interface PluginManifest {
  hooks?: PluginHook[];
  skills?: PluginSkill[];
  [key: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────

function resolvePackageRoot(): string {
  // When compiled to dist/scripts/, go up two levels to reach package root
  // When running as .ts (ts-jest), go up one level
  const candidate = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(candidate, 'package.json'))) {
    return candidate;
  }
  return path.resolve(__dirname, '..', '..');
}

function ensureDir(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
    return true;
  }
  return false;
}

// ── Step 1: Create .mindlore/ directories ──────────────────────────────

function createDirectories(baseDir: string): number {
  let created = 0;
  for (const dir of DIRECTORIES) {
    if (ensureDir(path.join(baseDir, dir))) {
      created++;
    }
  }
  return created;
}

// ── Step 2: Copy template files ────────────────────────────────────────

function copyTemplates(baseDir: string, packageRoot: string): number {
  const templatesDir = path.join(packageRoot, 'templates');
  let copied = 0;

  for (const file of TEMPLATE_FILES) {
    const dest = path.join(baseDir, file);
    if (!fs.existsSync(dest)) {
      const src = path.join(templatesDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        copied++;
      } else {
        log(`WARNING: template not found: ${src}`);
      }
    }
  }

  // Copy SCHEMA.md
  const schemaSrc = path.join(packageRoot, 'SCHEMA.md');
  const schemaDest = path.join(baseDir, 'SCHEMA.md');
  if (!fs.existsSync(schemaDest)) {
    if (fs.existsSync(schemaSrc)) {
      fs.copyFileSync(schemaSrc, schemaDest);
      copied++;
    }
  }

  // Copy extraction templates (preserve existing — don't overwrite user customizations)
  const srcExtractionDir = path.join(packageRoot, 'templates', 'extraction');
  const destExtractionDir = path.join(baseDir, 'templates', 'extraction');
  if (fs.existsSync(srcExtractionDir)) {
    fs.mkdirSync(destExtractionDir, { recursive: true });
    for (const file of fs.readdirSync(srcExtractionDir)) {
      const destPath = path.join(destExtractionDir, file);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(path.join(srcExtractionDir, file), destPath);
      }
    }
  }

  return copied;
}

// ── Step 3: Create FTS5 database ───────────────────────────────────────

interface PragmaRow {
  name: string;
}

function resetSchema(db: import('better-sqlite3').Database): void {
  db.exec('DROP TABLE IF EXISTS mindlore_fts');
  db.exec(SQL_FTS_CREATE);
  db.exec('DELETE FROM file_hashes');
}

function migrateDatabase(dbPath: string, DatabaseCtor: typeof import('better-sqlite3')): boolean {
  const db = new DatabaseCtor(dbPath);
  try {
    const info = dbPragma<PragmaRow>(db, 'table_info(mindlore_fts)');
    const columns = info.map((r) => r.name);
    if (!columns.includes('slug') || !columns.includes('description')) {
      log('Upgrading FTS5 schema (2 → 9 columns, porter stemmer)...');
      resetSchema(db);
      db.close();
      return true;
    } else if (!columns.includes('tags')) {
      log('Upgrading FTS5 schema (7 → 9 columns, +tags +quality)...');
      resetSchema(db);
      db.close();
      return true;
    } else if (!columns.includes('date_captured')) {
      log('Upgrading FTS5 schema (9 → 10 columns, +date_captured)...');
      resetSchema(db);
      db.close();
      return true;
    } else if (!columns.includes('project')) {
      log('Upgrading FTS5 schema (10 → 11 columns, +project)...');
      resetSchema(db);
      db.close();
      return true;
    }
  } catch (_err) {
    resetSchema(db);
    db.close();
    return true;
  }
  db.close();
  return false;
}

function createDatabase(baseDir: string): boolean {
  const dbPath = path.join(baseDir, DB_NAME);

  let DatabaseCtor: typeof import('better-sqlite3');
  try {
    DatabaseCtor = require('better-sqlite3');
  } catch (_err) {
    log('WARNING: better-sqlite3 not installed. Run: npm install better-sqlite3');
    log('Database creation skipped — run mindlore init again after installing.');
    return false;
  }

  if (fs.existsSync(dbPath)) {
    const migrated = migrateDatabase(dbPath, DatabaseCtor);
    if (migrated) {
      log('FTS5 schema upgraded — run index to rebuild');
    } else {
      log('Database already exists, schema OK');
    }
    // Idempotent: ensure episodes table on pre-v0.4 databases
    const dbEp = new DatabaseCtor(dbPath);
    dbEp.pragma('journal_mode = WAL');
    dbEp.pragma('busy_timeout = 5000');
    ensureEpisodesTableCjs(dbEp);
    ensureSchemaTable(dbEp);
    runMigrations(dbEp, INIT_MIGRATIONS);
    dbEp.close();
    return migrated;
  }

  const db = new DatabaseCtor(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(SQL_FTS_CREATE);

  db.exec(`
    CREATE TABLE IF NOT EXISTS file_hashes (
      path TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      last_indexed TEXT NOT NULL
    );
  `);

  // Idempotent: pre-v0.4 installs won't have this table
  ensureEpisodesTableCjs(db);

  // v0.6.2 + v0.6.3 migrations
  ensureSchemaTable(db);
  runMigrations(db, INIT_MIGRATIONS);

  db.close();
  return true;
}

// ── Step 4: Merge hooks into settings.json ─────────────────────────────

interface HookEntry { hooks?: Array<{ command?: string }>; command?: string }

function countMindloreHooks(allHooks: Record<string, unknown[]>): number {
  let total = 0;
  for (const event of Object.keys(allHooks)) {
    const entries = allHooks[event] ?? [];
    for (const raw of entries) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- caller-controlled JSON shape from settings.json
      const entry = raw as HookEntry;
      const hooks = entry.hooks && Array.isArray(entry.hooks) ? entry.hooks : [entry];
      for (const h of hooks) {
        if ((h.command ?? '').includes('mindlore-')) total++;
      }
    }
  }
  return total;
}

function mergeHooks(packageRoot: string, existingPlugin?: PluginManifest): { added: number; total: number } | false {
  const settingsPath = path.join(homedir(), '.claude', 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    log('WARNING: ~/.claude/settings.json not found. Hooks not registered.');
    log('Create it manually or install Claude Code first.');
    return false;
  }

  let settings: Settings;
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    settings = parseJsonObject<Settings>(raw);
  } catch (_err) {
    log('WARNING: Could not parse settings.json. Hooks not registered.');
    return false;
  }

  let plugin: PluginManifest;
  if (existingPlugin) {
    plugin = existingPlugin;
  } else {
    const pluginPath = path.join(packageRoot, 'plugin.json');
    if (!fs.existsSync(pluginPath)) {
      log('WARNING: plugin.json not found. Hooks not registered.');
      return false;
    }
    plugin = readJsonFile<PluginManifest>(pluginPath);
  }
  if (!plugin.hooks || plugin.hooks.length === 0) {
    return false;
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }

  let added = 0;
  for (const hook of plugin.hooks) {
    const event = hook.event;
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    const hookScript = path.join(packageRoot, hook.script);
    const hookName = path.basename(hook.script, '.cjs');

    const exists = settings.hooks[event].some((entry) => {
      if (entry.hooks && Array.isArray(entry.hooks)) {
        return entry.hooks.some((h) => (h.command ?? '').includes(hookName));
      }
      return (entry.command ?? '').includes(hookName);
    });

    if (!exists) {
      settings.hooks[event].push({
        hooks: [
          {
            type: 'command',
            command: `node "${hookScript}"`,
          },
        ],
      });
      added++;
    }
  }

  if (added > 0) {
    const backupPath = settingsPath + '.mindlore-backup';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  // Count total mindlore hooks across all events
  const total = countMindloreHooks(settings.hooks ?? {});

  return { added, total };
}

// ── Step 5: Add SCHEMA.md to projectDocFiles ───────────────────────────

function addSchemaToProjectDocs(): boolean {
  const projectSettingsDir = path.join(process.cwd(), '.claude');
  const projectSettingsPath = path.join(projectSettingsDir, 'settings.json');

  let settings: Settings = {};
  if (fs.existsSync(projectSettingsPath)) {
    try {
      settings = parseJsonObject<Settings>(fs.readFileSync(projectSettingsPath, 'utf8'));
    } catch (_err) {
      settings = {};
    }
  } else {
    ensureDir(projectSettingsDir);
  }

  if (!settings.projectDocFiles) {
    settings.projectDocFiles = [];
  }

  const schemaPath = path.join(GLOBAL_MINDLORE_DIR, 'SCHEMA.md');
  if (!settings.projectDocFiles.includes(schemaPath)) {
    settings.projectDocFiles.push(schemaPath);
    fs.writeFileSync(
      projectSettingsPath,
      JSON.stringify(settings, null, 2),
      'utf8',
    );
    return true;
  }
  return false;
}

// ── Step 6: Register skills ────────────────────────────────────────────

function registerSkills(packageRoot: string, plugin: PluginManifest): number {
  const skillsDir = path.join(homedir(), '.claude', 'skills');
  ensureDir(skillsDir);

  if (!plugin.skills || plugin.skills.length === 0) return 0;

  let added = 0;
  for (const skill of plugin.skills) {
    const skillSrcDir = path.join(packageRoot, path.dirname(skill.path));
    const skillDestDir = path.join(skillsDir, skill.name);

    ensureDir(skillDestDir);
    const entries = fs.readdirSync(skillSrcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      fs.copyFileSync(
        path.join(skillSrcDir, entry.name),
        path.join(skillDestDir, entry.name),
      );
    }
    added++;
  }

  return added;
}

// ── Step 7: Install better-sqlite3 if needed ──────────────────────────

function ensureBetterSqlite3(): boolean {
  try {
    require('better-sqlite3');
    return true;
  } catch (_err) {
    try {
      log('Installing better-sqlite3 (native dependency)...');
      execFileSync('npm', ['install', 'better-sqlite3', '--no-save'], {
        cwd: process.cwd(),
        stdio: 'pipe',
        timeout: 120000,
      });
      return true;
    } catch (_installErr) {
      log('WARNING: Could not install better-sqlite3. FTS5 search disabled.');
      log('  Run manually: npm install better-sqlite3');
      return false;
    }
  }
}

// ── Step 8: Ensure config.json with models ────────────────────────────

type MindloreConfig = import('../hooks/lib/mindlore-common.cjs').MindloreConfig;

function ensureConfig(baseDir: string, packageRoot: string): boolean {
  const configDest = path.join(baseDir, CONFIG_FILE);
  const configSrc = path.join(packageRoot, 'templates', CONFIG_FILE);

  if (!fs.existsSync(configDest)) {
    // No config yet — copy template
    if (fs.existsSync(configSrc)) {
      fs.copyFileSync(configSrc, configDest);
      return true;
    }
    // Template missing — write hardcoded defaults
    const defaultConfig: MindloreConfig = { version: '0.3.1', models: { ...DEFAULT_MODELS } };
    fs.writeFileSync(configDest, JSON.stringify(defaultConfig, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    return true;
  }

  // Config exists — merge missing fields from template
  let config: MindloreConfig;
  try {
    config = readJsonFile<MindloreConfig>(configDest);
  } catch (_err) {
    return false;
  }

  let changed = false;

  if (!config.models) {
    config.models = { ...DEFAULT_MODELS };
    changed = true;
  }

  // Merge missing fields from template (handles top-level + nested objects)
  if (fs.existsSync(configSrc)) {
    const template = readJsonFile<MindloreConfig>(configSrc);
    /* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- MindloreConfig is a plain object, safe to cast */
    const { result: merged, changed: mergeChanged } = mergeDefaults(
      config as unknown as Record<string, unknown>,
      template as unknown as Record<string, unknown>,
    );
    /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
    if (mergeChanged) {
      Object.assign(config, merged);
      changed = true;
    }
    if (config.version !== template.version) {
      config.version = template.version;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(configDest, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  }

  return changed;
}

// Step 9 removed — .gitignore no longer needed (global dir outside project)

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'uninstall') {
    require('./uninstall.js');
    return;
  }

  if (command === 'upgrade') {
    process.argv = [...process.argv.slice(0, 2), 'init', '--upgrade'];
    main();
    return;
  }

  // CLI subcommands — delegate to dist scripts
  const cliCommands: Record<string, { script: string; passArgs: boolean }> = {
    health: { script: './mindlore-health-check.js', passArgs: false },
    search: { script: './mindlore-fts5-search.js', passArgs: true },
    index: { script: './mindlore-fts5-index.js', passArgs: false },
    quality: { script: './quality-populate.js', passArgs: false },
    backup: { script: './mindlore-backup.js', passArgs: true },
    obsidian: { script: './mindlore-obsidian.js', passArgs: true },
    episodes: { script: './mindlore-episodes.js', passArgs: true },
    'memory-sync': { script: './cc-memory-bulk-sync.js', passArgs: true },
    'fetch-raw': { script: './fetch-raw.js', passArgs: true },
    daemon: { script: './mindlore-daemon.js', passArgs: true },
  };

  const cliCmd = command ? cliCommands[command] : undefined;
  if (cliCmd) {
    const scriptPath = path.join(__dirname, cliCmd.script);
    if (!fs.existsSync(scriptPath)) {
      console.error(`Script not found: ${scriptPath}`);
      process.exit(1);
    }
    // Reset process.argv so sub-scripts see clean args
    const scriptArgs = cliCmd.passArgs ? args.slice(1) : [];
    process.argv = [process.argv[0] ?? 'node', scriptPath, ...scriptArgs];
    require(scriptPath);
    return;
  }

  if (command && command !== 'init') {
    console.log(`Unknown command: ${command}`);
    console.log('Usage: npx mindlore init [--recommended]');
    console.log('       npx mindlore uninstall [--all]');
    console.log('       npx mindlore health');
    console.log('       npx mindlore search "<query>"');
    console.log('       npx mindlore index');
    console.log('       npx mindlore quality');
    console.log('       npx mindlore backup init|status|remote|now');
    console.log('       npx mindlore obsidian export|import|status');
    console.log('       npx mindlore episodes list|search|show');
    console.log('       npx mindlore memory-sync');
    console.log('       npx mindlore fetch-raw <url>');
    console.log('       npx mindlore daemon start|stop|status');
    console.log('       npx mindlore upgrade');
    process.exit(1);
  }

  const isRecommended = args.includes('--recommended');
  const packageRoot = resolvePackageRoot();
  // Resolution order: MINDLORE_HOME env var > ~/.mindlore/ (global default).
  // Project-local .mindlore/ was removed in v0.3.3 and is migrated to .mindlore.bak/ below.
  const baseDir = GLOBAL_MINDLORE_DIR;

  const isUpgrade = process.argv.includes('--upgrade');
  console.log(`\n  Mindlore — AI-native knowledge system [${isUpgrade ? 'upgrade' : 'global'} (~/.mindlore/)]\n`);

  // v0.3.3 Migration: rename existing project .mindlore/ → .mindlore.bak/
  const projectMindlore = path.join(process.cwd(), MINDLORE_DIR);
  if (fs.existsSync(projectMindlore) && projectMindlore !== baseDir) {
    const backupPath = path.join(process.cwd(), '.mindlore.bak');
    if (!fs.existsSync(backupPath)) {
      fs.renameSync(projectMindlore, backupPath);
      log('Migrated project .mindlore/ → .mindlore.bak/ (verify then delete)');
    } else {
      log('Project .mindlore/ exists — .mindlore.bak/ already present, skipping migration');
    }
  }

  // Step 1: Directories (skip on upgrade — dirs already exist)
  if (!isUpgrade) {
    const dirsCreated = createDirectories(baseDir);
    log(
      dirsCreated > 0
        ? `Created ${dirsCreated} directories in ${MINDLORE_DIR}/`
        : 'All directories already exist',
    );
  }

  // Step 2: Templates (always run — may have new templates)
  const filesCopied = copyTemplates(baseDir, packageRoot);
  log(
    filesCopied > 0
      ? `Copied ${filesCopied} template files`
      : 'All templates already in place',
  );

  // Step 3: better-sqlite3 (before DB creation so it's available)
  ensureBetterSqlite3();

  // Step 4: Database
  const dbCreated = createDatabase(baseDir);
  log(dbCreated ? 'Created FTS5 database' : 'Database already exists');

  // Step 4b: Auto-index existing .md files into FTS5
  try {
    const indexScript = path.join(packageRoot, 'dist', 'scripts', 'mindlore-fts5-index.js');
    if (fs.existsSync(indexScript)) {
      execFileSync('node', [indexScript], { cwd: baseDir, stdio: 'pipe', timeout: 30000 });
      log('Auto-indexed existing files into FTS5');
    }
  } catch (_err) {
    log('WARNING: Auto-index failed — run: npx mindlore index');
  }

  // Read plugin.json once for hooks + skills
  const pluginPath = path.join(packageRoot, 'plugin.json');
  const plugin: PluginManifest = fs.existsSync(pluginPath)
    ? readJsonFile<PluginManifest>(pluginPath)
    : {};

  // Step 5: Hooks
  const hooksResult = mergeHooks(packageRoot, plugin);
  if (typeof hooksResult === 'object' && hooksResult !== null) {
    if (hooksResult.added > 0) {
      log(`Registered ${hooksResult.added} new hooks (${hooksResult.total} total) in ~/.claude/settings.json`);
    } else {
      log(`Hooks already registered (${hooksResult.total} total)`);
    }
  } else {
    log('Hooks not registered (settings.json not found)');
  }

  // Step 6: SCHEMA.md in projectDocFiles (global SCHEMA.md path)
  const schemaAdded = addSchemaToProjectDocs();
  log(
    schemaAdded
      ? 'Added SCHEMA.md to project settings'
      : 'SCHEMA.md already in project settings',
  );

  // Step 7: Skills
  const skillsAdded = registerSkills(packageRoot, plugin);
  log(
    skillsAdded > 0
      ? `Registered ${skillsAdded} skills in ~/.claude/skills/`
      : 'Skills already registered',
  );

  // Step 8: Config (models for model-router hook)
  const configCreated = ensureConfig(baseDir, packageRoot);
  log(
    configCreated
      ? 'Created config.json with model defaults'
      : 'config.json already configured',
  );

  // Step 9: Init git repo in ~/.mindlore/ (always global now)
  const gitDir = path.join(baseDir, '.git');
  if (!fs.existsSync(gitDir)) {
    try {
      execFileSync('git', ['init'], { cwd: baseDir, stdio: 'pipe', timeout: 10000 });
      log('Initialized git repo in ~/.mindlore/');
    } catch (_err) {
      log('WARNING: Could not init git repo. Install git for auto-sync.');
    }
  } else {
    log('Git repo already initialized');
  }

  // Step 10: Create project namespace directories
  const projectName = path.basename(process.cwd());
  const namespaceDirs = ['raw', 'sources', 'diary', 'decisions'];
  let nsCreated = 0;
  for (const dir of namespaceDirs) {
    if (ensureDir(path.join(baseDir, dir, projectName))) {
      nsCreated++;
    }
  }
  log(
    nsCreated > 0
      ? `Created ${nsCreated} project namespace dirs (${projectName}/)`
      : `Project namespace already exists (${projectName}/)`,
  );

  // Backup guide
  console.log('\n  Backup: Auto-sync your knowledge to a private GitHub repo:');
  log('  npx mindlore backup github');
  log('  (Requires: gh CLI + GitHub login. Session-end hook auto-pushes.)');

  // Recommended profile tips
  if (isRecommended) {
    console.log('\n  Recommended setup:');
    log('Install markitdown for better web/doc extraction:');
    log('  pip install markitdown');
    log('');
    log('Install context-mode for token savings:');
    log('  See: https://github.com/context-mode/context-mode');
  }

  // Step 11: Auto-backfill on upgrade + write .version + .pkg-version
  const packageJson = readJsonFile<{ version: string }>(path.join(packageRoot, 'package.json'));
  const versionPath = path.join(baseDir, '.version');
  const pkgVersionPath = path.join(baseDir, '.pkg-version');
  const currentVersion = fs.existsSync(versionPath) ? fs.readFileSync(versionPath, 'utf8').trim() : '0.0.0';
  if (currentVersion < '0.5.4') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- dynamic CJS require, typed manually
      const { runBackfill } = require('./lib/backfill.js') as unknown as { runBackfill: (db: import('better-sqlite3').Database, dir: string) => { createdAtFixed: number; importanceMapped: number; projectScopeSet: number } };
      const dbPath = path.join(baseDir, DB_NAME);
      if (fs.existsSync(dbPath)) {
        const DatabaseBackfill: typeof import('better-sqlite3') = require('better-sqlite3');
        const db = new DatabaseBackfill(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        const result = runBackfill(db, baseDir);
        log(`Backfill: ${result.createdAtFixed} timestamps, ${result.importanceMapped} importance, ${result.projectScopeSet} scope`);
        db.close();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Auto-backfill failed (non-fatal):', msg);
    }
  }
  fs.writeFileSync(versionPath, packageJson.version, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(pkgVersionPath, packageJson.version, { encoding: 'utf8', mode: 0o600 });
  log(`Version: ${packageJson.version}`);

  // Step 12: Register agents (v0.6.1)
  const agentsAdded = registerAgents(packageRoot);
  if (agentsAdded > 0) {
    log(`Registered ${agentsAdded} agents in ~/.claude/agents/`);
  }

  // Step 13: Auto-doctor (v0.6.1)
  runDoctor(packageRoot);

  console.log('\n  Done! Start with: /mindlore-ingest\n');
}

function registerAgents(packageRoot: string): number {
  const agentsDir = path.join(packageRoot, 'agents');
  if (!fs.existsSync(agentsDir)) return 0;

  const targetDir = path.join(homedir(), '.claude', 'agents');
  ensureDir(targetDir);

  let copied = 0;
  for (const file of fs.readdirSync(agentsDir)) {
    const src = path.join(agentsDir, file);
    const dest = path.join(targetDir, file);
    if (!fs.statSync(src).isFile()) continue;
    if (fs.existsSync(dest)) {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);
      if (srcStat.size === destStat.size && srcStat.mtimeMs <= destStat.mtimeMs) continue;
    }
    fs.copyFileSync(src, dest);
    copied++;
  }
  return copied;
}

function runDoctor(packageRoot: string): void {
  try {
    const doctorScript = path.join(packageRoot, 'dist', 'scripts', 'mindlore-doctor.js');
    if (fs.existsSync(doctorScript)) {
      const { execFileSync } = require('child_process');
      execFileSync(process.execPath, [doctorScript], {
        stdio: 'inherit', timeout: 10000, windowsHide: true,
      });
    }
  } catch { /* doctor failure is non-blocking */ }
}

main();
