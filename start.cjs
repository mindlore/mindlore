#!/usr/bin/env node
/**
 * Mindlore MCP Server bootstrap (context-mode pattern).
 *
 * CC plugin marketplace install pipeline does NOT run `npm install` —
 * it just extracts the tarball. Native deps (better-sqlite3, sqlite-vec)
 * need install-time platform binaries that bundledDependencies cannot
 * ship cross-platform (sqlite-vec uses optionalDependencies pattern with
 * per-platform packages, better-sqlite3 v12 ships no prebuilds/ dir).
 *
 * Strategy: this wrapper runs BEFORE mcp-server.cjs. It detects missing
 * or wrong-platform native binaries and self-heals via `npm install` in
 * the plugin cache dir. First boot is 5-30s (one-time), subsequent boots
 * are <100ms (existsSync fast path).
 *
 * Why a separate wrapper instead of inlining in mcp-server.cjs:
 *   1. mcp-server.cjs is an esbuild bundle — adding logic before the
 *      require('better-sqlite3') happens at the top of the bundle is hard
 *   2. Single source of truth — hooks can also import ensure-deps later
 *   3. Easier to swap out if CC plugin spec adds postinstall hooks
 *
 * See: feedback_cc_plugin_self_contained.md, feedback_multi_platform_binary.md
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync, spawn } = require('node:child_process');

const __dirname_ = __dirname;
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Native dep manifest — package + expected binary location after install
const NATIVE_DEPS = [
  {
    pkg: 'better-sqlite3',
    binary: ['build', 'Release', 'better_sqlite3.node'],
  },
  // sqlite-vec uses optionalDependencies for per-platform packages
  // (sqlite-vec-{linux,darwin,win32}-{x64,arm64}). npm picks the right one
  // at install time. We just check the wrapper package presence — the
  // platform-specific binary is auto-selected by sqlite-vec loader.
  {
    pkg: 'sqlite-vec',
    binary: null, // loader handles platform selection
  },
];

const RUNTIME_DEPS = [
  '@modelcontextprotocol/sdk',
  'zod',
];

function log(msg) {
  // stderr — stdout is reserved for MCP JSON-RPC
  process.stderr.write(`[mindlore-bootstrap] ${msg}\n`);
}

function depPresent({ pkg, binary }) {
  const pkgDir = path.join(__dirname_, 'node_modules', pkg);
  if (!fs.existsSync(pkgDir)) return false;
  if (binary && !fs.existsSync(path.join(pkgDir, ...binary))) return false;
  return true;
}

function probeBetterSqlite3() {
  // Child process probe — in-process require() caches dlopen, can't detect
  // on-disk binary swaps (ABI mismatch or wrong-platform binary).
  try {
    execSync(
      `node -e "new (require('better-sqlite3'))(':memory:').close()"`,
      { cwd: __dirname_, stdio: 'pipe', timeout: 10000 }
    );
    return true;
  } catch {
    return false;
  }
}

function installMissing(packages) {
  if (packages.length === 0) return true;
  log(`installing missing packages: ${packages.join(', ')}`);
  log('(first boot only — subsequent boots <100ms)');
  try {
    execSync(
      `${NPM} install ${packages.join(' ')} --no-package-lock --no-save --silent`,
      { cwd: __dirname_, stdio: 'pipe', timeout: 180000, shell: true }
    );
    log('install complete');
    return true;
  } catch (err) {
    log(`install failed: ${err && err.message ? err.message : String(err)}`);
    log('MCP server may not function — check network + write permissions in plugin cache dir');
    return false;
  }
}

function rebuildBetterSqlite3() {
  log('rebuilding better-sqlite3 for current platform/ABI');
  try {
    execSync(`${NPM} rebuild better-sqlite3 --silent`, {
      cwd: __dirname_, stdio: 'pipe', timeout: 120000, shell: true,
    });
    return true;
  } catch (err) {
    log(`rebuild failed: ${err && err.message ? err.message : String(err)}`);
    return false;
  }
}

function ensureDeps() {
  // Fast path: everything present
  const allDeps = [...NATIVE_DEPS, ...RUNTIME_DEPS.map((pkg) => ({ pkg, binary: null }))];
  const missing = allDeps.filter((d) => !depPresent(d));

  if (missing.length > 0) {
    const installed = installMissing(missing.map((d) => d.pkg));
    if (!installed) return false;
  }

  // ABI probe — even if binary file exists, it may be wrong platform
  // (someone copied tarball cross-platform, or `prebuild-install` cached wrong arch).
  if (!probeBetterSqlite3()) {
    log('better-sqlite3 binary present but fails probe (likely ABI mismatch or wrong platform)');
    rebuildBetterSqlite3();
    // Re-probe after rebuild
    if (!probeBetterSqlite3()) {
      log('rebuild did not fix the probe — MCP boot may fail');
      // Don't exit — let downstream require() surface the actual error
    }
  }

  return true;
}

// Run ensure layer
ensureDeps();

// Boot the actual MCP server
require('./mcp-server.cjs');
