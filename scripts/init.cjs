#!/usr/bin/env node
'use strict';

/**
 * mindlore init — Initialize .mindlore/ knowledge base in current project.
 *
 * Usage: npx mindlore init [--recommended]
 *
 * Idempotent: running again does not destroy existing data.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────────────

const MINDLORE_DIR = '.mindlore';
const DB_NAME = 'mindlore.db';

const DIRECTORIES = [
  'raw',
  'sources',
  'domains',
  'analyses',
  'insights',
  'connections',
  'learnings',
  'diary',
  'decisions',
];

const TEMPLATE_FILES = ['INDEX.md', 'log.md'];

// ── Helpers ────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`  ${msg}`);
}

function resolvePackageRoot() {
  // When installed globally via npm, __dirname is inside the package
  // Look for templates/ relative to this script
  return path.resolve(__dirname, '..');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

// ── Step 1: Create .mindlore/ directories ──────────────────────────────

function createDirectories(baseDir) {
  let created = 0;
  for (const dir of DIRECTORIES) {
    if (ensureDir(path.join(baseDir, dir))) {
      created++;
    }
  }
  return created;
}

// ── Step 2: Copy template files ────────────────────────────────────────

function copyTemplates(baseDir, packageRoot) {
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

  return copied;
}

// ── Step 3: Create FTS5 database ───────────────────────────────────────

function createDatabase(baseDir) {
  const dbPath = path.join(baseDir, DB_NAME);
  if (fs.existsSync(dbPath)) {
    log('Database already exists, skipping');
    return false;
  }

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (_err) {
    log('WARNING: better-sqlite3 not installed. Run: npm install better-sqlite3');
    log('Database creation skipped — run mindlore init again after installing.');
    return false;
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts
    USING fts5(path, content, tokenize='unicode61');
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS file_hashes (
      path TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      last_indexed TEXT NOT NULL
    );
  `);

  db.close();
  return true;
}

// ── Step 4: Merge hooks into settings.json ─────────────────────────────

function mergeHooks(packageRoot) {
  const settingsPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '~',
    '.claude',
    'settings.json'
  );

  if (!fs.existsSync(settingsPath)) {
    log('WARNING: ~/.claude/settings.json not found. Hooks not registered.');
    log('Create it manually or install Claude Code first.');
    return false;
  }

  let settings;
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(raw);
  } catch (_err) {
    log('WARNING: Could not parse settings.json. Hooks not registered.');
    return false;
  }

  // Read plugin.json for hook definitions
  const pluginPath = path.join(packageRoot, 'plugin.json');
  if (!fs.existsSync(pluginPath)) {
    log('WARNING: plugin.json not found. Hooks not registered.');
    return false;
  }

  const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
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

    // Check if this hook already exists (by script path containing 'mindlore-')
    const hookScript = path.join(packageRoot, hook.script);
    const hookName = path.basename(hook.script, '.cjs');

    const exists = settings.hooks[event].some((h) => {
      const cmd = typeof h === 'string' ? h : h.command || '';
      return cmd.includes(hookName);
    });

    if (!exists) {
      settings.hooks[event].push({
        type: 'command',
        command: `node "${hookScript}"`,
      });
      added++;
    }
  }

  if (added > 0) {
    // Backup before writing
    const backupPath = settingsPath + '.mindlore-backup';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  return added;
}

// ── Step 5: Add SCHEMA.md to projectDocFiles ───────────────────────────

function addSchemaToProjectDocs() {
  const projectSettingsDir = path.join(process.cwd(), '.claude');
  const projectSettingsPath = path.join(projectSettingsDir, 'settings.json');

  let settings = {};
  if (fs.existsSync(projectSettingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf8'));
    } catch (_err) {
      settings = {};
    }
  } else {
    ensureDir(projectSettingsDir);
  }

  if (!settings.projectDocFiles) {
    settings.projectDocFiles = [];
  }

  const schemaPath = path.join(MINDLORE_DIR, 'SCHEMA.md');
  if (!settings.projectDocFiles.includes(schemaPath)) {
    settings.projectDocFiles.push(schemaPath);
    fs.writeFileSync(
      projectSettingsPath,
      JSON.stringify(settings, null, 2),
      'utf8'
    );
    return true;
  }
  return false;
}

// ── Step 6: Add .mindlore/ to .gitignore ───────────────────────────────

function addToGitignore() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const entry = '.mindlore/';

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (content.includes(entry)) {
      return false;
    }
    fs.appendFileSync(gitignorePath, `\n${entry}\n`, 'utf8');
  } else {
    fs.writeFileSync(gitignorePath, `${entry}\n`, 'utf8');
  }
  return true;
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command && command !== 'init') {
    console.log(`Unknown command: ${command}`);
    console.log('Usage: npx mindlore init [--recommended]');
    process.exit(1);
  }

  const isRecommended = args.includes('--recommended');
  const packageRoot = resolvePackageRoot();
  const baseDir = path.join(process.cwd(), MINDLORE_DIR);

  console.log('\n  Mindlore — AI-native knowledge system\n');

  // Step 1: Directories
  const dirsCreated = createDirectories(baseDir);
  log(
    dirsCreated > 0
      ? `Created ${dirsCreated} directories in ${MINDLORE_DIR}/`
      : 'All directories already exist'
  );

  // Step 2: Templates
  const filesCopied = copyTemplates(baseDir, packageRoot);
  log(
    filesCopied > 0
      ? `Copied ${filesCopied} template files`
      : 'All templates already in place'
  );

  // Step 3: Database
  const dbCreated = createDatabase(baseDir);
  log(dbCreated ? 'Created FTS5 database' : 'Database already exists');

  // Step 4: Hooks
  const hooksAdded = mergeHooks(packageRoot);
  if (typeof hooksAdded === 'number' && hooksAdded > 0) {
    log(`Registered ${hooksAdded} hooks in ~/.claude/settings.json`);
  } else {
    log('Hooks already registered (or settings.json not found)');
  }

  // Step 5: SCHEMA.md in projectDocFiles
  const schemaAdded = addSchemaToProjectDocs();
  log(
    schemaAdded
      ? 'Added SCHEMA.md to project settings'
      : 'SCHEMA.md already in project settings'
  );

  // Step 6: .gitignore
  const gitignoreAdded = addToGitignore();
  log(
    gitignoreAdded
      ? 'Added .mindlore/ to .gitignore'
      : '.mindlore/ already in .gitignore'
  );

  // Recommended profile tips
  if (isRecommended) {
    console.log('\n  Recommended setup:');
    log('Install markitdown for better web/doc extraction:');
    log('  pip install markitdown');
    log('');
    log('Install context-mode for token savings:');
    log('  See: https://github.com/context-mode/context-mode');
  }

  console.log('\n  Done! Start with: /mindlore-ingest\n');
}

main();
