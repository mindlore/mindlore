import fs from 'fs';
import path from 'path';
import type { McpContext } from '../mcp-tools.js';
import { parseFlatFrontmatter } from '../frontmatter.js';

interface RecallInput {
  type: 'decisions' | 'episodes' | 'learnings' | 'all';
  limit?: number;
  since?: string;
}

interface RecallItem {
  type: string;
  title: string;
  content: string;
  date: string;
  tags?: string[];
}

interface RecallOutput {
  items: RecallItem[];
  total: number;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
const MAX_SNIPPET = 500;

function readDir(dirPath: string, type: string, since?: string, limit?: number): RecallItem[] {
  let files: string[];
  try {
    files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md')).sort().reverse();
  } catch { return []; }
  const items: RecallItem[] = [];
  for (const file of files) {
    if (items.length >= (limit ?? DEFAULT_LIMIT)) break;
    const raw = fs.readFileSync(path.join(dirPath, file), 'utf8').replace(/\r\n/g, '\n');
    const parsed = parseFlatFrontmatter(raw);
    const meta = parsed?.meta ?? {};
    const body = parsed?.body ?? raw;
    const date = meta.date ?? '';
    if (since && date < since) continue;
    const tagsRaw = meta.tags ?? '';
    const tags = tagsRaw.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean);
    items.push({
      type,
      title: meta.title ?? file.replace('.md', ''),
      content: body.length > MAX_SNIPPET ? body.slice(0, MAX_SNIPPET) + '...' : body,
      date,
      tags: tags.length > 0 ? tags : undefined,
    });
  }
  return items;
}

export function handleRecall(ctx: McpContext, input: RecallInput): RecallOutput {
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const types = input.type === 'all' ? ['decisions', 'episodes', 'learnings'] : [input.type];

  let allItems: RecallItem[] = [];
  for (const t of types) {
    const dir = path.join(ctx.baseDir, t);
    allItems.push(...readDir(dir, t, input.since, limit));
  }

  allItems.sort((a, b) => b.date.localeCompare(a.date));
  allItems = allItems.slice(0, limit);

  return { items: allItems, total: allItems.length };
}
