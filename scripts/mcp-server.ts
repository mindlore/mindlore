#!/usr/bin/env node

import { execSync } from 'child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs';
import path from 'path';
import { resolveMindloreHome } from './lib/mcp-namespace.js';
import { MCP_BUSY_TIMEOUT_MS, DB_NAME } from './lib/constants.js';
import { registerAllTools } from './lib/mcp-tools.js';
import { errMsg } from './lib/err-msg.js';

function resolvePluginRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'node_modules', 'better-sqlite3'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return __dirname;
}

function ensureSqliteBinding(root: string): void {
  const modDir = path.join(root, 'node_modules', 'better-sqlite3');
  const bindingPath = path.join(modDir, 'build', 'Release', 'better_sqlite3.node');
  if (fs.existsSync(modDir) && !fs.existsSync(bindingPath)) {
    process.stderr.write('mindlore-mcp: rebuilding better-sqlite3 native binding...\n');
    try {
      execSync('npm rebuild better-sqlite3', {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      });
    } catch (e) {
      process.stderr.write(`mindlore-mcp: auto-rebuild failed. Run manually:\n  cd "${root}" && npm rebuild better-sqlite3\n`);
      process.stderr.write(`  Error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }
}

const pluginRoot = resolvePluginRoot();
ensureSqliteBinding(pluginRoot);

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- absolute path required for plugin cache resolution
const Database: typeof import('better-sqlite3') = require(path.join(pluginRoot, 'node_modules', 'better-sqlite3'));

const PACKAGE_VERSION = (() => {
  try {
    const pkgPath = fs.existsSync(path.join(__dirname, 'package.json'))
      ? path.join(__dirname, 'package.json')
      : path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- package.json structure is known
    return (pkg as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

async function main(): Promise<void> {
  const baseDir = resolveMindloreHome();

  // Auto-init: ensure .mindlore/ exists
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
    // Minimal init — full init.ts is heavyweight, just ensure dirs + DB
    for (const sub of ['sources', 'episodes', 'decisions', 'diary', 'raw', 'domains', 'analyses', 'learnings']) {
      const dir = path.join(baseDir, sub);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  const dbPath = path.join(baseDir, DB_NAME);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma(`busy_timeout = ${MCP_BUSY_TIMEOUT_MS}`);

  // Create MCP server
  const server = new McpServer({
    name: 'mindlore',
    version: PACKAGE_VERSION,
  });

  registerAllTools(server, { db, baseDir });

  // Stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Parent death detection — stdin EOF
  process.stdin.on('end', () => {
    db.close();
    process.exit(0);
  });

  // Graceful shutdown
  const shutdown = (): void => {
    try { db.close(); } catch { /* already closed */ }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Windows: no PPID check, stdin EOF is sufficient
  if (process.platform !== 'win32') {
    const parentPid = process.ppid;
    const ppidCheck = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch {
        clearInterval(ppidCheck);
        shutdown();
      }
    }, 5000);
    ppidCheck.unref();
  }
}

main().catch((err) => {
  process.stderr.write(`mindlore-mcp fatal: ${errMsg(err)}\n`);
  process.exit(1);
});
