#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { resolveMindloreHome } from './lib/mcp-namespace.js';
import { MCP_BUSY_TIMEOUT_MS, DB_NAME } from './lib/constants.js';
import { registerAllTools } from './lib/mcp-tools.js';
import { errMsg } from './lib/err-msg.js';

const PACKAGE_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
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

  // Open DB with WAL mode + busy_timeout
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
