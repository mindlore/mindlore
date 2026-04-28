import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

function validateUrl(raw: string): URL {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error(`Unsupported protocol: ${u.protocol}`);
  }
  return u;
}

interface FetchResult {
  saved: string;
  chars: number;
  method: 'github-api' | 'curl' | 'jina';
}

function slugFromUrl(url: string): string {
  const parsed = new URL(url);

  // GitHub repo: owner/repo → repo slug
  const ghMatch = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (parsed.hostname === 'github.com' && ghMatch) {
    return (ghMatch[2] ?? '').replace(/\.git$/, '').toLowerCase();
  }

  // Strip common noise from pathname
  const segments = parsed.pathname
    .replace(/\/$/, '')
    .split('/')
    .filter(s => s && !['index.html', 'index.htm', 'README.md'].includes(s));

  if (segments.length > 0) {
    // Take last 2 meaningful segments max
    const tail = segments.slice(-2).join('-');
    const slug = tail
      .replace(/\.[^.]+$/, '')       // strip extension
      .replace(/[^a-zA-Z0-9-]/g, '-') // non-alphanumeric → dash
      .replace(/-{2,}/g, '-')         // collapse dashes
      .replace(/^-|-$/g, '')          // trim dashes
      .toLowerCase();
    if (slug.length >= 3) return slug;
  }

  // Fallback: hash (only if URL has no useful path)
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
      let cleaned = raw;
      let prev: string;
      do {
        prev = cleaned;
        cleaned = cleaned
          .replace(/<script[^>]*>[\s\S]*?<\/script\s*>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '');
      } while (cleaned !== prev);
      return cleaned
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
    `title: "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    `source_url: ${url}`,
    `date_captured: ${now}`,
    'quality: unreviewed',
    '---',
    '',
  ].join('\n');
}

function findExistingFile(outDir: string, slug: string): string | null {
  if (!fs.existsSync(outDir)) return null;
  const files = fs.readdirSync(outDir).filter(f => f.endsWith(`-${slug}.md`));
  if (files.length === 0) return null;
  files.sort();
  const latest = files[files.length - 1];
  return latest ? path.join(outDir, latest) : null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function main(): void {
  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');
  const outDirFlag = args.indexOf('--out-dir');
  const skipIndices = new Set<number>();
  if (outDirFlag >= 0) { skipIndices.add(outDirFlag); skipIndices.add(outDirFlag + 1); }
  const url = args.find((a, i) => !a.startsWith('--') && !skipIndices.has(i));
  const outDir: string = (outDirFlag >= 0 && args[outDirFlag + 1])
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by args[outDirFlag + 1] truthiness check above
    ? args[outDirFlag + 1]!
    : path.join(process.env.MINDLORE_HOME ?? path.join(os.homedir(), '.mindlore'), 'raw');

  if (!url) {
    console.error('Usage: node fetch-raw.js <URL> [--out-dir <path>] [--force]');
    process.exit(1);
  }

  const parsedUrl = validateUrl(url);
  const safeUrl = parsedUrl.href;
  const slug = slugFromUrl(safeUrl);

  if (!forceFlag) {
    const existing = findExistingFile(outDir, slug);
    if (existing) {
      const stat = fs.statSync(existing);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < CACHE_TTL_MS) {
        const hoursAgo = Math.round(ageMs / (60 * 60 * 1000));
        console.log(JSON.stringify({ cached: true, file: existing, hours_ago: hoursAgo }));
        return;
      }
    }
  }

  let content: string | null = null;
  let method: FetchResult['method'] = 'curl';

  if (parsedUrl.hostname === 'github.com' || parsedUrl.hostname.endsWith('.github.com')) {
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

  const frontmatter = generateFrontmatter(safeUrl, slug, content);
  const fullContent = frontmatter + content;

  const newHash = crypto.createHash('sha256').update(content).digest('hex');
  const existing = findExistingFile(outDir, slug);
  if (existing && !forceFlag) {
    const oldContent = fs.readFileSync(existing, 'utf8');
    const bodyStart = oldContent.indexOf('---', 4);
    const oldBody = bodyStart > 0 ? oldContent.slice(bodyStart + 3).trim() : oldContent;
    const oldHash = crypto.createHash('sha256').update(oldBody).digest('hex');
    if (newHash === oldHash) {
      fs.utimesSync(existing, new Date(), new Date());
      console.log(JSON.stringify({ cached: true, file: existing, reason: 'content_unchanged' }));
      return;
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `${new Date().toISOString().split('T')[0]}-${slug}.md`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, fullContent, 'utf8');

  const result: FetchResult = { saved: filePath, chars: content.length, method };
  console.log(JSON.stringify(result));
}

main();
