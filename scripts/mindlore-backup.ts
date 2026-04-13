#!/usr/bin/env node

/**
 * mindlore backup — Git-based backup for ~/.mindlore/
 *
 * Usage:
 *   mindlore backup init         — Create .gitignore, initial commit
 *   mindlore backup status       — Show git status + last commit
 *   mindlore backup remote <url> — Set remote origin
 *   mindlore backup now          — Manual commit + push
 */

import fs from 'fs';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { GLOBAL_MINDLORE_DIR, log } from './lib/constants.js';

const BASE_DIR = GLOBAL_MINDLORE_DIR;
const GIT_DIR = path.join(BASE_DIR, '.git');

const GITIGNORE_CONTENT = `*.db
*.db-wal
*.db-shm
_session-reads-*.json
_pattern-cache-*.json
`;

function backupInit(): void {

  if (!fs.existsSync(BASE_DIR)) {
    console.error('  ~/.mindlore/ not found. Run: npx mindlore init');
    process.exit(1);
  }

  // Create .gitignore
  const gitignorePath = path.join(BASE_DIR, '.gitignore');
  fs.writeFileSync(gitignorePath, GITIGNORE_CONTENT, 'utf8');
  log('Created .gitignore');

  // Init git if needed
  if (!fs.existsSync(GIT_DIR)) {
    execSync('git init', { cwd: BASE_DIR, stdio: 'pipe', timeout: 10000 });
    log('Initialized git repo');
  } else {
    log('Git repo already initialized');
  }

  // Initial commit
  try {
    execSync('git add -A', { cwd: BASE_DIR, stdio: 'pipe', timeout: 10000 });
    const status = execSync('git status --porcelain', {
      cwd: BASE_DIR,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    if (status) {
      execSync('git commit -m "mindlore backup init"', {
        cwd: BASE_DIR,
        stdio: 'pipe',
        timeout: 10000,
      });
      log('Initial commit created');
    } else {
      log('Nothing to commit');
    }
  } catch (_err) {
    log('WARNING: Could not create initial commit');
  }
}

function backupStatus(): void {

  if (!fs.existsSync(GIT_DIR)) {
    console.log('  Backup not initialized. Run: mindlore backup init');
    return;
  }

  try {
    const lastCommit = execSync('git log --oneline -1', {
      cwd: BASE_DIR,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    log(`Last commit: ${lastCommit}`);
  } catch (_err) {
    log('No commits yet');
  }

  try {
    const remote = execSync('git remote get-url origin', {
      cwd: BASE_DIR,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    log(`Remote: ${remote}`);
  } catch (_err) {
    log('Remote: not configured');
  }

  try {
    const status = execSync('git status --short', {
      cwd: BASE_DIR,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    if (status) {
      const lines = status.split('\n');
      log(`Uncommitted: ${lines.length} file(s)`);
    } else {
      log('Working tree clean');
    }
  } catch (_err) {
    log('Could not get status');
  }
}

function backupRemote(url: string): void {

  if (!fs.existsSync(GIT_DIR)) {
    console.error('  Backup not initialized. Run: mindlore backup init');
    process.exit(1);
  }

  try {
    try {
      execSync('git remote get-url origin', {
        cwd: BASE_DIR,
        stdio: 'pipe',
        timeout: 5000,
      });
      execFileSync('git', ['remote', 'set-url', 'origin', url], {
        cwd: BASE_DIR,
        stdio: 'pipe',
        timeout: 5000,
      });
      log(`Remote updated: ${url}`);
    } catch (_err) {
      execFileSync('git', ['remote', 'add', 'origin', url], {
        cwd: BASE_DIR,
        stdio: 'pipe',
        timeout: 5000,
      });
      log(`Remote added: ${url}`);
    }
  } catch (_err) {
    log('WARNING: Could not set remote');
  }
}

function backupNow(): void {

  if (!fs.existsSync(GIT_DIR)) {
    console.error('  Backup not initialized. Run: mindlore backup init');
    process.exit(1);
  }

  try {
    execSync('git add -A', { cwd: BASE_DIR, stdio: 'pipe', timeout: 10000 });
    const status = execSync('git status --porcelain', {
      cwd: BASE_DIR,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    if (!status) {
      log('Nothing to commit — working tree clean');
      return;
    }

    const now = new Date().toISOString().slice(0, 19);
    execSync(`git commit -m "mindlore backup ${now}"`, {
      cwd: BASE_DIR,
      stdio: 'pipe',
      timeout: 10000,
    });
    log('Committed');

    try {
      execSync('git remote get-url origin', {
        cwd: BASE_DIR,
        stdio: 'pipe',
        timeout: 5000,
      });
      execSync('git push', { cwd: BASE_DIR, stdio: 'pipe', timeout: 15000 });
      log('Pushed to remote');
    } catch (_err) {
      log('No remote configured — local commit only');
    }
  } catch (_err) {
    log('WARNING: Backup failed');
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const subcommand = args[0];

  console.log('\n  Mindlore Backup\n');

  switch (subcommand) {
    case 'init':
      backupInit();
      break;
    case 'status':
      backupStatus();
      break;
    case 'remote':
      if (!args[1]) {
        console.error('  Usage: mindlore backup remote <url>');
        process.exit(1);
      }
      backupRemote(args[1]);
      break;
    case 'now':
      backupNow();
      break;
    default:
      console.log('  Usage:');
      log('mindlore backup init         — Initialize backup');
      log('mindlore backup status       — Show backup status');
      log('mindlore backup remote <url> — Set remote repository');
      log('mindlore backup now          — Commit + push now');
      break;
  }
}

main();
