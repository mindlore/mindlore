import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export interface McpContext {
  db: Database;
  baseDir: string;
}

export function registerAllTools(server: McpServer, ctx: McpContext): void {
  // Tool adapters will be registered here in Tasks 6-8
  void server;
  void ctx;
}
