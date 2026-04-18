import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

function validateUrl(raw: string): string {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error(`Unsupported protocol: ${u.protocol}`);
  }
  return u.href;
}

interface FetchResult {
  saved: string;
  chars: number;
  method: 'github-api' | 'curl' | 'jina';
}

function slugFromUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 12);
}

function fetchGitHubReadme(url: string): string | null {
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  const [, owner, repo] = match;
  try {
    const result = execSync(
      `gh api repos/${owner}/${repo}/readme --jq .content`,
      { encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return Buffer.from(result.trim(), 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function fetchCurl(url: string): string | null {
  try {
    const raw = execFileSync(
      'curl', ['-sL', '--max-time', '20', '--max-filesize', '5242880', url],
      { encoding: 'utf8', timeout: 25000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    if (raw.includes('<html') || raw.includes('<!DOCTYPE')) {
      return raw
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    return raw;
  } catch {
    return null;
  }
}

function fetchJina(url: string): string | null {
  try {
    const result = execFileSync(
      'curl', ['-sL', '--max-time', '30', `https://r.jina.ai/${url}`],
      { encoding: 'utf8', timeout: 35000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result;
  } catch {
    return null;
  }
}

function generateFrontmatter(url: string, slug: string, content: string): string {
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? slug;
  const now = new Date().toISOString().split('T')[0];
  return [
    '---',
    `slug: ${slug}`,
    'type: raw',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `source_url: ${url}`,
    `date_captured: ${now}`,
    'quality: unreviewed',
    '---',
    '',
  ].join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const outDirFlag = args.indexOf('--out-dir');
  const skipIndices = new Set<number>();
  if (outDirFlag >= 0) { skipIndices.add(outDirFlag); skipIndices.add(outDirFlag + 1); }
  const url = args.find((a, i) => !a.startsWith('--') && !skipIndices.has(i));
  const outDir: string = (outDirFlag >= 0 && args[outDirFlag + 1])
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by args[outDirFlag + 1] truthiness check above
    ? args[outDirFlag + 1]!
    : path.join(process.env.MINDLORE_HOME ?? path.join(os.homedir(), '.mindlore'), 'raw');

  if (!url) {
    console.error('Usage: node fetch-raw.js <URL> [--out-dir <path>]');
    process.exit(1);
  }

  const safeUrl = validateUrl(url);

  let content: string | null = null;
  let method: FetchResult['method'] = 'curl';

  if (safeUrl.includes('github.com')) {
    content = fetchGitHubReadme(safeUrl);
    if (content) method = 'github-api';
  }

  if (!content) {
    content = fetchCurl(safeUrl);
    method = 'curl';
  }

  if (!content || content.length < 100) {
    content = fetchJina(safeUrl);
    method = 'jina';
  }

  if (!content || content.length < 50) {
    console.error(JSON.stringify({ error: 'All fetch methods failed', url: safeUrl }));
    process.exit(1);
  }

  const slug = slugFromUrl(safeUrl);
  const frontmatter = generateFrontmatter(safeUrl, slug, content);
  const fullContent = frontmatter + content;

  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `${new Date().toISOString().split('T')[0]}-${slug}.md`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, fullContent, 'utf8');

  const result: FetchResult = { saved: filePath, chars: content.length, method };
  console.log(JSON.stringify(result));
}

main();
