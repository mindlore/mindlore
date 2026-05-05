import fs from 'fs';
import path from 'path';
import type { McpContext } from '../mcp-tools.js';
import { slugify } from '../slugify.js';

interface IngestInput {
  type: 'text' | 'file';
  content: string;
  title?: string;
  tags?: string[];
}

interface IngestOutput {
  slug: string;
  path: string;
  wordCount: number;
  indexed: boolean;
}

export function handleIngest(ctx: McpContext, input: IngestInput): IngestOutput {
  if (!input.content || input.content.trim().length === 0) {
    throw new Error('Content is required and cannot be empty');
  }

  let body: string;
  let title: string;

  if (input.type === 'file') {
    const filePath = path.resolve(input.content);
    try {
      body = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    } catch { throw new Error(`File not found: ${filePath}`); }
    title = input.title ?? path.basename(filePath, path.extname(filePath));
  } else {
    body = input.content;
    title = input.title ?? body.slice(0, 50).replace(/\n/g, ' ');
  }

  const slug = slugify(title);
  if (!slug) throw new Error('Cannot generate slug from title');

  const date = new Date().toISOString().slice(0, 10);
  const tags = input.tags ?? [];
  const frontmatter = [
    '---',
    `slug: ${slug}`,
    `type: source`,
    `date: ${date}`,
    `title: ${title}`,
    tags.length > 0 ? `tags: [${tags.join(', ')}]` : null,
    '---',
  ].filter(Boolean).join('\n');

  const fullContent = `${frontmatter}\n\n${body}\n`;
  const outPath = path.join(ctx.baseDir, 'raw', `${slug}.md`);

  const rawDir = path.join(ctx.baseDir, 'raw');
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(outPath, fullContent);

  const wordCount = body.split(/\s+/).filter(Boolean).length;

  return {
    slug,
    path: outPath,
    wordCount,
    indexed: false, // FTS5 indexing happens via FileChanged hook or manual npm run index
  };
}
