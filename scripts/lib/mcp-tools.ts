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
import { handleRelate } from './tool-adapters/relate-adapter.js';
import { handleGet } from './tool-adapters/get-adapter.js';
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

function wrapTool<TInput, TOutput>(
  ctx: McpContext,
  toolName: string,
  handler: (ctx: McpContext, input: TInput) => TOutput
): (input: TInput) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }> {
  return async (input: TInput) => {
    return withMcpTelemetry(ctx.baseDir, toolName, async () => {
      try {
        return toolResult(handler(ctx, input));
      } catch (err) {
        return toolError(errMsg(err));
      }
    });
  };
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
    wrapTool(ctx, 'mindlore_search', handleSearch)
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
    wrapTool(ctx, 'mindlore_ingest', handleIngest)
  );

  server.tool(
    'mindlore_recall',
    'Retrieve decisions, episodes, or learnings',
    {
      type: z.enum(['decisions', 'episodes', 'learnings', 'all']).describe('What to recall'),
      limit: z.number().min(1).max(50).optional().describe('Max items (default: 10)'),
      since: z.string().optional().describe('ISO date filter (UTC)'),
    },
    wrapTool(ctx, 'mindlore_recall', handleRecall)
  );

  server.tool(
    'mindlore_brief',
    'Project briefing — summary of knowledge base state',
    {
      scope: z.enum(['full', 'recent']).optional().describe('Scope (default: recent)'),
    },
    wrapTool(ctx, 'mindlore_brief', handleBrief)
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
    wrapTool(ctx, 'mindlore_decide', (c, input) => {
      if (input.action === 'save') {
        if (!input.title || !input.rationale) {
          throw new Error('title and rationale are required for save action');
        }
        return handleDecide(c, {
          action: 'save',
          title: input.title,
          rationale: input.rationale,
          alternatives: input.alternatives,
          supersedes: input.supersedes,
        });
      }
      return handleDecide(c, {
        action: 'list',
        limit: input.limit,
        since: input.since,
      });
    })
  );

  server.tool(
    'mindlore_stats',
    'Health check and database statistics',
    {
    },
    wrapTool(ctx, 'mindlore_stats', (_c, _input) => handleStats(ctx))
  );

  server.tool(
    'mindlore_relate',
    'Manage source-to-source relations (Knowledge Graph)',
    {
      action: z.enum(['add', 'remove', 'list']).describe('Action'),
      source_a: z.string().optional().describe('Source slug (required for add/remove)'),
      source_b: z.string().optional().describe('Target source slug (required for add/remove)'),
      relation_type: z.enum(['cites', 'extends', 'contradicts', 'supersedes']).optional()
        .describe('Relation type (required for add/remove)'),
      source: z.string().optional().describe('Filter relations by source slug (for list)'),
    },
    wrapTool(ctx, 'mindlore_relate', handleRelate)
  );

  server.tool(
    'mindlore_get',
    'Retrieve full content or specific section of a knowledge source',
    {
      source: z.string().describe('Source slug'),
      section: z.string().optional().describe('Heading title for section-level retrieval'),
      include_relations: z.boolean().optional().describe('Include related sources (default: true)'),
    },
    wrapTool(ctx, 'mindlore_get', handleGet)
  );
}
