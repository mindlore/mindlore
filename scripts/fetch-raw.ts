import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { sanitizeForExecFile, validatePath, validateUrl as validateUrlSsrf, escapeYamlValue } from './lib/input-validation.js';
import { GLOBAL_MINDLORE_DIR } from './lib/constants.js';

function validateUrl(raw: string): URL {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error(`Unsupported protocol: ${u.protocol}`);
  }
  validateUrlSsrf(u);
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
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return null;
  try {
    const safeOwner = sanitizeForExecFile(owner);
    const safeRepo = sanitizeForExecFile(repo);
    const result = execFileSync(
      'gh',
      ['api', `repos/${safeOwner}/${safeRepo}/readme`, '--jq', '.content'],
      { encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return Buffer.from(result.trim(), 'base64').toString('utf8');
  } catch {
    return null;
  }
}

interface CachedHeaders {
  etag?: string;
  lastModified?: string;
}

function loadCachedHeaders(outDir: string, slug: string): CachedHeaders {
  const metaPath = path.join(outDir, `.${slug}.meta.json`);
  if (!fs.existsSync(metaPath)) return {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return {};
    const obj = Object.fromEntries(Object.entries(parsed));
    const result: CachedHeaders = {};
    if (typeof obj.etag === 'string') result.etag = obj.etag;
    if (typeof obj.lastModified === 'string') result.lastModified = obj.lastModified;
    return result;
  } catch { return {}; }
}

function saveCachedHeaders(outDir: string, slug: string, headers: CachedHeaders): void {
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(outDir, `.${slug}.meta.json`), JSON.stringify(headers), { mode: 0o600 });
}

function parseResponseHeaders(headerFile: string): CachedHeaders {
  if (!fs.existsSync(headerFile)) return {};
  try {
    const raw = fs.readFileSync(headerFile, 'utf8');
    const result: CachedHeaders = {};
    const etagMatch = raw.match(/^etag:\s*(.+)$/mi);
    if (etagMatch) result.etag = etagMatch[1]?.trim();
    const lmMatch = raw.match(/^last-modified:\s*(.+)$/mi);
    if (lmMatch) result.lastModified = lmMatch[1]?.trim();
    return result;
  } catch { return {}; }
}

function fetchCurl(url: string, cachedHeaders?: CachedHeaders): { content: string | null; responseHeaders: CachedHeaders } {
  const headerFile = path.join(os.tmpdir(), `mindlore-headers-${Date.now()}.txt`);
  try {
    const args = ['-sL', '--max-time', '20', '--max-filesize', '5242880', '--dump-header', headerFile];
    if (cachedHeaders?.etag) args.push('-H', `If-None-Match: ${cachedHeaders.etag}`);
    if (cachedHeaders?.lastModified) args.push('-H', `If-Modified-Since: ${cachedHeaders.lastModified}`);
    args.push(url);
    const raw = execFileSync(
      'curl', args,
      { encoding: 'utf8', timeout: 25000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const respHeaders = parseResponseHeaders(headerFile);
    // Check for 304 by reading header file
    const headerContent = fs.existsSync(headerFile) ? fs.readFileSync(headerFile, 'utf8') : '';
    if (headerContent.includes(' 304 ')) return { content: null, responseHeaders: respHeaders };
    if (raw.includes('<html') || raw.includes('<!DOCTYPE')) {
      let cleaned = raw;
      let prev: string;
      do {
        prev = cleaned;
        cleaned = cleaned
          .replace(/<script[^>]*>[\s\S]*?<\/script\s*>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style\s*>/gi, '');
      } while (cleaned !== prev);
      const text = cleaned
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return { content: text, responseHeaders: respHeaders };
    }
    return { content: raw, responseHeaders: respHeaders };
  } catch {
    return { content: null, responseHeaders: {} };
  } finally {
    try { if (fs.existsSync(headerFile)) fs.unlinkSync(headerFile); } catch { /* cleanup */ }
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

function resolveSlugCollision(slug: string, url: string, outDir: string): string {
  if (!fs.existsSync(outDir)) return slug;
  const existing = fs.readdirSync(outDir).find(f => f.endsWith(`-${slug}.md`));
  if (!existing) return slug;
  const content = fs.readFileSync(path.join(outDir, existing), 'utf8');
  const urlMatch = content.match(/^source_url:\s*(.+)$/m);
  if (urlMatch && urlMatch[1]?.trim() !== url) {
    const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 8);
    return `${slug}-${hash}`;
  }
  return slug;
}

function generateFrontmatter(url: string, slug: string, content: string): string {
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? slug;
  const now = new Date().toISOString().split('T')[0];
  return [
    '---',
    `slug: ${slug}`,
    'type: raw',
    `title: ${escapeYamlValue(title)}`,
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
    : path.join(GLOBAL_MINDLORE_DIR, 'raw');
  validatePath(outDir, GLOBAL_MINDLORE_DIR);

  if (!url) {
    console.error('Usage: node fetch-raw.js <URL> [--out-dir <path>] [--force]');
    process.exit(1);
  }

  const parsedUrl = validateUrl(url);
  const safeUrl = parsedUrl.href;
  const slug = resolveSlugCollision(slugFromUrl(safeUrl), safeUrl, outDir);

  let cachedPath = findExistingFile(outDir, slug);
  if (!forceFlag && cachedPath) {
    const stat = fs.statSync(cachedPath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < CACHE_TTL_MS) {
      const hoursAgo = Math.round(ageMs / (60 * 60 * 1000));
      console.log(JSON.stringify({ cached: true, file: cachedPath, hours_ago: hoursAgo }));
      return;
    }
  }

  let content: string | null = null;
  let method: FetchResult['method'] = 'curl';
  const cached = loadCachedHeaders(outDir, slug);

  if (parsedUrl.hostname === 'github.com' || parsedUrl.hostname.endsWith('.github.com')) {
    content = fetchGitHubReadme(safeUrl);
    if (content) method = 'github-api';
  }

  if (!content) {
    const curlResult = fetchCurl(safeUrl, cached);
    if (curlResult.content === null && (cached.etag || cached.lastModified)) {
      // 304 Not Modified
      if (cachedPath) {
        fs.utimesSync(cachedPath, new Date(), new Date());
        console.log(JSON.stringify({ cached: true, file: cachedPath, reason: '304_not_modified' }));
        return;
      }
    }
    content = curlResult.content;
    method = 'curl';
    if (curlResult.responseHeaders.etag || curlResult.responseHeaders.lastModified) {
      saveCachedHeaders(outDir, slug, curlResult.responseHeaders);
    }
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
  if (!cachedPath) cachedPath = findExistingFile(outDir, slug);
  if (cachedPath && !forceFlag) {
    const oldContent = fs.readFileSync(cachedPath, 'utf8');
    const bodyStart = oldContent.indexOf('---', 4);
    const oldBody = bodyStart > 0 ? oldContent.slice(bodyStart + 3).trim() : oldContent;
    const oldHash = crypto.createHash('sha256').update(oldBody).digest('hex');
    if (newHash === oldHash) {
      fs.utimesSync(cachedPath, new Date(), new Date());
      console.log(JSON.stringify({ cached: true, file: cachedPath, reason: 'content_unchanged' }));
      return;
    }
  }

  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const fileName = `${new Date().toISOString().split('T')[0]}-${slug}.md`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, fullContent, { encoding: 'utf8', mode: 0o600 });

  const result: FetchResult = { saved: filePath, chars: content.length, method };
  console.log(JSON.stringify(result));
}

main();
