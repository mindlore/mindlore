import fs from 'fs';
import path from 'path';
import type { McpContext } from '../mcp-tools.js';

interface DecideSaveInput {
  action: 'save';
  title: string;
  rationale: string;
  alternatives?: string[];
  supersedes?: string;
}

interface DecideListInput {
  action: 'list';
  limit?: number;
  since?: string;
}

type DecideInput = DecideSaveInput | DecideListInput;

interface DecideSaveOutput {
  slug: string;
  path: string;
}

interface DecideListOutput {
  decisions: Array<{
    slug: string;
    title: string;
    date: string;
    supersededBy?: string;
  }>;
  total: number;
}

type DecideOutput = DecideSaveOutput & Partial<DecideListOutput>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');
}

export function handleDecide(ctx: McpContext, input: DecideInput): DecideOutput {
  const decisionsDir = path.join(ctx.baseDir, 'decisions');
  if (!fs.existsSync(decisionsDir)) fs.mkdirSync(decisionsDir, { recursive: true });

  if (input.action === 'save') {
    const slug = slugify(input.title);
    if (!slug) throw new Error('Cannot generate slug from title');
    const date = new Date().toISOString().slice(0, 10);

    const lines = [
      '---',
      `slug: ${slug}`,
      `type: decision`,
      `date: ${date}`,
      `title: ${input.title}`,
    ];
    if (input.supersedes) lines.push(`supersedes: ${input.supersedes}`);
    lines.push('---', '', `## Rationale`, '', input.rationale);
    if (input.alternatives && input.alternatives.length > 0) {
      lines.push('', '## Alternatives Considered', '');
      for (const alt of input.alternatives) {
        lines.push(`- ${alt}`);
      }
    }
    lines.push('');

    const outPath = path.join(decisionsDir, `${slug}.md`);
    fs.writeFileSync(outPath, lines.join('\n'));
    return { slug, path: outPath };
  }

  // action === 'list'
  const files = fs.readdirSync(decisionsDir).filter(f => f.endsWith('.md')).sort().reverse();
  const limit = Math.min(input.limit ?? 10, 50);
  const decisions: DecideListOutput['decisions'] = [];

  for (const file of files) {
    if (decisions.length >= limit) break;
    const raw = fs.readFileSync(path.join(decisionsDir, file), 'utf8').replace(/\r\n/g, '\n');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;
    const fmBlock = match[1];
    if (fmBlock === undefined) continue;
    const meta: Record<string, string> = {};
    for (const line of fmBlock.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    if (input.since && (meta.date ?? '') < input.since) continue;
    decisions.push({
      slug: meta.slug ?? file.replace('.md', ''),
      title: meta.title ?? file.replace('.md', ''),
      date: meta.date ?? '',
      supersededBy: meta.superseded_by,
    });
  }

  return { slug: '', path: '', decisions, total: decisions.length };
}
