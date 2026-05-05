import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import { handleSearch } from './tool-adapters/search-adapter.js';
import { handleStats } from './tool-adapters/stats-adapter.js';
import { handleRecall } from './tool-adapters/recall-adapter.js';
import { handleBrief } from './tool-adapters/brief-adapter.js';
import { handleIngest } from './tool-adapters/ingest-adapter.js';
import { handleDecide } from './tool-adapters/decide-adapter.js';
import { withMcpTelemetry } from './mcp-telemetry.js';
import { errMsg } from './err-msg.js';

export interface McpContext {
  db: Database;
  baseDir: string;
}

function toolResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function registerAllTools(server: McpServer, ctx: McpContext): void {
  server.tool(
    'mindlore_search',
    'FTS5 + hybrid search across Mindlore knowledge base',
    {
      query: z.string().describe('Search query'),
      limit: z.number().min(1).max(20).optional().describe('Max results (default: 5)'),
      scope: z.enum(['sources', 'episodes', 'decisions', 'all']).optional().describe('Filter scope'),
      contentType: z.enum(['code', 'prose']).optional().describe('Content type filter'),
    },
    async (input) => {
      return withMcpTelemetry(ctx.baseDir, 'mindlore_search', async () => {
        try {
          return toolResult(handleSearch(ctx, input));
        } catch (err) {
          return toolError(errMsg(err));
        }
      });
    }
  );

  server.tool(
    'mindlore_ingest',
    'Add knowledge to Mindlore (text or file)',
    {
      type: z.enum(['text', 'file']).describe('Source type'),
      content: z.string().describe('Text content, URL, or file path'),
      title: z.string().optional().describe('Title (auto-detected if omitted)'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
    async (input) => {
      return withMcpTelemetry(ctx.baseDir, 'mindlore_ingest', async () => {
        try {
          return toolResult(handleIngest(ctx, input));
        } catch (err) {
          return toolError(errMsg(err));
        }
      });
    }
  );

  server.tool(
    'mindlore_recall',
    'Retrieve decisions, episodes, or learnings',
    {
      type: z.enum(['decisions', 'episodes', 'learnings', 'all']).describe('What to recall'),
      limit: z.number().min(1).max(50).optional().describe('Max items (default: 10)'),
      since: z.string().optional().describe('ISO date filter (UTC)'),
    },
    async (input) => {
      return withMcpTelemetry(ctx.baseDir, 'mindlore_recall', async () => {
        try {
          return toolResult(handleRecall(ctx, input));
        } catch (err) {
          return toolError(errMsg(err));
        }
      });
    }
  );

  server.tool(
    'mindlore_brief',
    'Project briefing — summary of knowledge base state',
    {
      scope: z.enum(['full', 'recent']).optional().describe('Scope (default: recent)'),
    },
    async (input) => {
      return withMcpTelemetry(ctx.baseDir, 'mindlore_brief', async () => {
        try {
          return toolResult(handleBrief(ctx, input));
        } catch (err) {
          return toolError(errMsg(err));
        }
      });
    }
  );

  server.tool(
    'mindlore_decide',
    'Record or list decisions with supersedes chain',
    {
      action: z.enum(['save', 'list']).describe('Action'),
      title: z.string().optional().describe('Decision title (required for save)'),
      rationale: z.string().optional().describe('Rationale (required for save)'),
      alternatives: z.array(z.string()).optional().describe('Alternatives considered'),
      supersedes: z.string().optional().describe('Slug of superseded decision'),
      limit: z.number().min(1).max(50).optional().describe('Max items for list'),
      since: z.string().optional().describe('ISO date filter for list'),
    },
    async (input) => {
      return withMcpTelemetry(ctx.baseDir, 'mindlore_decide', async () => {
        try {
          if (input.action === 'save') {
            if (!input.title || !input.rationale) {
              return toolError('title and rationale are required for save action');
            }
            return toolResult(handleDecide(ctx, {
              action: 'save',
              title: input.title,
              rationale: input.rationale,
              alternatives: input.alternatives,
              supersedes: input.supersedes,
            }));
          }
          return toolResult(handleDecide(ctx, {
            action: 'list',
            limit: input.limit,
            since: input.since,
          }));
        } catch (err) {
          return toolError(errMsg(err));
        }
      });
    }
  );

  server.tool(
    'mindlore_stats',
    'Health check and database statistics',
    {
    },
    async () => {
      return withMcpTelemetry(ctx.baseDir, 'mindlore_stats', async () => {
        try {
          return toolResult(handleStats(ctx));
        } catch (err) {
          return toolError(errMsg(err));
        }
      });
    }
  );
}
