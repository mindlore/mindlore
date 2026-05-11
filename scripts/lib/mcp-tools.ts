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

const TOOL_NAMES = {
  search: 'mindlore_search',
  ingest: 'mindlore_ingest',
  recall: 'mindlore_recall',
  brief: 'mindlore_brief',
  decide: 'mindlore_decide',
  stats: 'mindlore_stats',
  relate: 'mindlore_relate',
  get: 'mindlore_get',
} as const;

function wrapTool<TInput extends object, TOutput>(
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
    TOOL_NAMES.search,
    'FTS5 + hybrid search across Mindlore knowledge base',
    {
      query: z.string().describe('Search query'),
      limit: z.number().min(1).max(20).optional().describe('Max results (default: 5)'),
      scope: z.enum(['sources', 'episodes', 'decisions', 'all']).optional().describe('Filter scope'),
      contentType: z.enum(['code', 'prose']).optional().describe('Content type filter'),
    },
    wrapTool(ctx, TOOL_NAMES.search, handleSearch)
  );

  server.tool(
    TOOL_NAMES.ingest,
    'Add knowledge to Mindlore (text or file)',
    {
      type: z.enum(['text', 'file']).describe('Source type'),
      content: z.string().describe('Text content, URL, or file path'),
      title: z.string().optional().describe('Title (auto-detected if omitted)'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
    wrapTool(ctx, TOOL_NAMES.ingest, handleIngest)
  );

  server.tool(
    TOOL_NAMES.recall,
    'Retrieve decisions, episodes, or learnings',
    {
      type: z.enum(['decisions', 'episodes', 'learnings', 'all']).describe('What to recall'),
      limit: z.number().min(1).max(50).optional().describe('Max items (default: 10)'),
      since: z.string().optional().describe('ISO date filter (UTC)'),
    },
    wrapTool(ctx, TOOL_NAMES.recall, handleRecall)
  );

  server.tool(
    TOOL_NAMES.brief,
    'Project briefing — summary of knowledge base state',
    {
      scope: z.enum(['full', 'recent']).optional().describe('Scope (default: recent)'),
    },
    wrapTool(ctx, TOOL_NAMES.brief, handleBrief)
  );

  server.tool(
    TOOL_NAMES.decide,
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- zod ShapeOutput union cannot narrow to DecideInput discriminant
    wrapTool(ctx, TOOL_NAMES.decide, (c, input) => handleDecide(c, input as unknown as import('./tool-adapters/decide-adapter.js').DecideInput))
  );

  server.tool(
    TOOL_NAMES.stats,
    'Health check and database statistics',
    {
    },
    wrapTool(ctx, TOOL_NAMES.stats, (_c, _input) => handleStats(ctx))
  );

  server.tool(
    TOOL_NAMES.relate,
    'Manage source-to-source relations (Knowledge Graph)',
    {
      action: z.enum(['add', 'remove', 'list']).describe('Action'),
      source_a: z.string().optional().describe('Source slug (required for add/remove)'),
      source_b: z.string().optional().describe('Target source slug (required for add/remove)'),
      relation_type: z.enum(['cites', 'extends', 'contradicts', 'supersedes']).optional()
        .describe('Relation type (required for add/remove)'),
      source: z.string().optional().describe('Filter relations by source slug (for list)'),
    },
    wrapTool(ctx, TOOL_NAMES.relate, handleRelate)
  );

  server.tool(
    TOOL_NAMES.get,
    'Retrieve full content or specific section of a knowledge source',
    {
      source: z.string().describe('Source slug'),
      section: z.string().optional().describe('Heading title for section-level retrieval'),
      include_relations: z.boolean().optional().describe('Include related sources (default: true)'),
    },
    wrapTool(ctx, TOOL_NAMES.get, handleGet)
  );
}
