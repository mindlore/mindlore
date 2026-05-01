#!/usr/bin/env node

/**
 * mindlore obsidian — Obsidian vault integration.
 *
 * Usage:
 *   mindlore obsidian export --vault /path/to/vault [--force]
 *   mindlore obsidian import --vault /path/to/vault [--folder notes/ai]
 *   mindlore obsidian status
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { GLOBAL_MINDLORE_DIR, log } from './lib/constants.js';
import { readJsonFile } from './lib/safe-parse.js';
import { validatePath } from './lib/input-validation.js';
import {
  convertToWikilinks,
  shouldExport,
  isObsidianVault,
  collectMdFiles,
} from './lib/obsidian-helpers.js';

interface ObsidianConfig {
  vault: string | null;
  lastExport: string | null;
  exportedFiles: number;
}

function readObsidianConfig(): ObsidianConfig {
  const configPath = path.join(GLOBAL_MINDLORE_DIR, 'config.json');
  try {
    const config = readJsonFile<Record<string, unknown>>(configPath);
    const obsidian = config.obsidian;
    if (obsidian !== null && typeof obsidian === 'object' && !Array.isArray(obsidian)) {
      const o = obsidian as Record<string, unknown>; // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion -- runtime-validated object, extracting known fields below
      return {
        vault: typeof o.vault === 'string' ? o.vault : null,
        lastExport: typeof o.lastExport === 'string' ? o.lastExport : null,
        exportedFiles: typeof o.exportedFiles === 'number' ? o.exportedFiles : 0,
      };
    }
    return { vault: null, lastExport: null, exportedFiles: 0 };
  } catch (_err) {
    return { vault: null, lastExport: null, exportedFiles: 0 };
  }
}

function saveObsidianConfig(obsidian: ObsidianConfig): void {
  const configPath = path.join(GLOBAL_MINDLORE_DIR, 'config.json');
  let config: Record<string, unknown> = {};
  try {
    config = readJsonFile<Record<string, unknown>>(configPath);
  } catch (_err) {
    config = {};
  }
  config.obsidian = obsidian;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault' && i + 1 < args.length) {
      const vaultVal = args[++i];
      if (typeof vaultVal !== 'string') throw new Error('Missing value for --vault');
      parsed.vault = vaultVal;
    } else if (args[i] === '--folder' && i + 1 < args.length) {
      const folderVal = args[++i];
      if (typeof folderVal !== 'string') throw new Error('Missing value for --folder');
      parsed.folder = folderVal;
    } else if (args[i] === '--force') {
      parsed.force = true;
    }
  }
  return parsed;
}

function obsidianExport(vaultPath: string, force: boolean): void {
  validatePath(vaultPath, os.homedir());
  if (!fs.existsSync(GLOBAL_MINDLORE_DIR)) {
    console.error('  ~/.mindlore/ not found. Run: npx mindlore init');
    process.exit(1);
  }

  if (!fs.existsSync(vaultPath)) {
    console.error(`  Vault not found: ${vaultPath}`);
    process.exit(1);
  }

  const destBase = path.join(vaultPath, 'mindlore');
  const files = collectMdFiles(GLOBAL_MINDLORE_DIR);

  let exported = 0;
  let skipped = 0;

  for (const file of files) {
    const destPath = path.join(destBase, file.relative);
    const destDir = path.dirname(destPath);

    if (!shouldExport(file.absolute, destPath, force)) {
      skipped++;
      continue;
    }

    fs.mkdirSync(destDir, { recursive: true });

    let content = fs.readFileSync(file.absolute, 'utf8');
    content = convertToWikilinks(content);

    fs.writeFileSync(destPath, content, 'utf8');
    exported++;
  }

  log(`Exported: ${exported} file(s), skipped: ${skipped} (unchanged)`);

  // Save config
  const obsidianConfig = readObsidianConfig();
  obsidianConfig.vault = vaultPath;
  obsidianConfig.lastExport = new Date().toISOString();
  obsidianConfig.exportedFiles = exported;
  saveObsidianConfig(obsidianConfig);
}

function obsidianImport(vaultPath: string, folder?: string): void {
  validatePath(vaultPath, os.homedir());
  if (!fs.existsSync(GLOBAL_MINDLORE_DIR)) {
    console.error('  ~/.mindlore/ not found. Run: npx mindlore init');
    process.exit(1);
  }

  const srcDir = folder ? path.join(vaultPath, folder) : vaultPath;

  if (!fs.existsSync(srcDir)) {
    console.error(`  Source not found: ${srcDir}`);
    process.exit(1);
  }

  // Collect .md files, excluding .obsidian/
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch (_err) {
    console.error(`  Could not read: ${srcDir}`);
    process.exit(1);
    return;
  }

  const rawDir = path.join(GLOBAL_MINDLORE_DIR, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  let imported = 0;

  for (const entry of entries) {
    if (entry.name === '.obsidian' || entry.name.startsWith('.')) continue;
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(rawDir, entry.name);

    let content = fs.readFileSync(srcPath, 'utf8');

    // Add source frontmatter if not present
    if (!content.startsWith('---')) {
      const slug = entry.name.replace('.md', '');
      content = `---\nslug: ${slug}\ntype: raw\nsource: obsidian-vault\ndate_captured: ${new Date().toISOString().slice(0, 10)}\n---\n\n${content}`;
    }

    fs.writeFileSync(destPath, content, 'utf8');
    imported++;
  }

  log(`Imported: ${imported} file(s) to raw/`);
  if (imported > 0) {
    log('Run `mindlore index` to update FTS5 search.');
  }
}

function obsidianStatus(): void {
  const config = readObsidianConfig();

  if (!config.vault) {
    log('No vault configured. Run: mindlore obsidian export --vault /path');
    return;
  }

  log(`Vault: ${config.vault}`);
  log(`Last export: ${config.lastExport ?? 'never'}`);
  log(`Files exported: ${config.exportedFiles}`);

  if (isObsidianVault(config.vault)) {
    log('Vault verified: .obsidian/ found');
  } else {
    log('WARNING: .obsidian/ not found — may not be an Obsidian vault');
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const subcommand = args[0];
  const parsed = parseArgs(args.slice(1));

  console.log('\n  Mindlore × Obsidian\n');

  switch (subcommand) {
    case 'export':
      if (!parsed.vault || typeof parsed.vault !== 'string') {
        console.error('  Usage: mindlore obsidian export --vault /path/to/vault [--force]');
        process.exit(1);
      }
      obsidianExport(parsed.vault, !!parsed.force);
      break;
    case 'import':
      if (!parsed.vault || typeof parsed.vault !== 'string') {
        console.error('  Usage: mindlore obsidian import --vault /path/to/vault [--folder subfolder]');
        process.exit(1);
      }
      obsidianImport(
        parsed.vault,
        typeof parsed.folder === 'string' ? parsed.folder : undefined,
      );
      break;
    case 'status':
      obsidianStatus();
      break;
    default:
      console.log('  Usage:');
      log('mindlore obsidian export --vault /path [--force]');
      log('mindlore obsidian import --vault /path [--folder subfolder]');
      log('mindlore obsidian status');
      break;
  }
}

main();
