import fs from 'fs';
import path from 'path';
import { extractUrl } from './lib/extractors/url-extractor.js';
import { extractPdf } from './lib/extractors/pdf-extractor.js';
import { extractFile } from './lib/extractors/file-extractor.js';
import { GLOBAL_MINDLORE_DIR } from './lib/constants.js';
import { safeMkdir, safeWriteFile } from './lib/secure-io.js';
import { slugify } from './lib/slugify.js';

function findRepoRoot(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return start;
}
const TEMPLATE_ROOT = path.join(findRepoRoot(__dirname), 'templates', 'source-types');
const FETCH_MAX_BYTES = 10 * 1024 * 1024;   // 10MB URL fetch cap
const INGEST_MAX_BYTES = 50 * 1024 * 1024;  // 50MB ingest source cap
const TEMPLATE_CACHE = new Map<string, string>();

async function fetchUrl(url: string): Promise<string> {
  const parsed = new URL(url);
  const blocked = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|::1$|fe80:|fc00:)/i;
  if (blocked.test(parsed.hostname)) {
    throw new Error(`Blocked URL host: ${parsed.hostname} (private/loopback)`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const contentLength = Number(res.headers.get('content-length') ?? '0');
    if (contentLength > FETCH_MAX_BYTES) throw new Error(`URL exceeds ${FETCH_MAX_BYTES} byte cap: ${contentLength} bytes`);
    const text = await res.text();
    if (text.length > FETCH_MAX_BYTES) throw new Error(`URL exceeds ${FETCH_MAX_BYTES} byte cap after read`);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function renderTemplate(templatePath: string, vars: Record<string, unknown>): string {
  let tpl = TEMPLATE_CACHE.get(templatePath);
  if (tpl === undefined) {
    tpl = fs.readFileSync(templatePath, 'utf8');
    TEMPLATE_CACHE.set(templatePath, tpl);
  }
  return tpl.replace(/{{(\w+)}}/g, (_, key) => String(vars[key] ?? ''));
}

function detectType(input: string): string {
  if (input.startsWith('http://') || input.startsWith('https://')) return 'url';
  const ext = path.extname(input).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  return 'file';
}

async function ingest(input: string, type: string): Promise<{ slug: string; rendered: string }> {
  switch (type) {
    case 'url': {
      const html = await fetchUrl(input);
      const ext = await extractUrl(input, html);
      const slug = slugify(ext.title);
      const rendered = renderTemplate(path.join(TEMPLATE_ROOT, 'url.md'), {
        ...ext,
        slug,
        url: ext.canonical_url,
        date: ext.fetched_at,
      });
      return { slug, rendered };
    }
    case 'pdf': {
      const pdfStat = fs.statSync(input);
      if (pdfStat.size > INGEST_MAX_BYTES) {
        throw new Error(`File too large: ${pdfStat.size} bytes (max ${INGEST_MAX_BYTES})`);
      }
      const buf = fs.readFileSync(input);
      const ext = await extractPdf(buf);
      const slug = slugify(ext.title);
      const rendered = renderTemplate(path.join(TEMPLATE_ROOT, 'pdf.md'), {
        ...ext,
        slug,
        date: ext.ingested_at,
        pageCount: ext.page_count,
      });
      return { slug, rendered };
    }
    case 'file': {
      const fileStat = fs.statSync(input);
      if (fileStat.size > INGEST_MAX_BYTES) {
        throw new Error(`File too large: ${fileStat.size} bytes (max ${INGEST_MAX_BYTES})`);
      }
      const content = fs.readFileSync(input, 'utf8');
      const ext = extractFile(input, content);
      const slug = slugify(path.basename(input, path.extname(input)));
      const rendered = renderTemplate(path.join(TEMPLATE_ROOT, 'file.md'), {
        ...ext,
        slug,
        filePath: ext.file_path,
        mtime: ext.last_modified,
        filename: path.basename(input),
      });
      return { slug, rendered };
    }
    default:
      throw new Error(`Unsupported ingest type: ${type}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const input = args[0];
  const typeFlag = args.indexOf('--type');
  const type = typeFlag >= 0 ? (args[typeFlag + 1] ?? '') : detectType(input ?? '');

  if (!input) {
    console.error('Usage: node mindlore-ingest.js <input> [--type <type>]');
    process.exit(1);
  }

  const outDir = path.join(GLOBAL_MINDLORE_DIR, 'sources');
  safeMkdir(outDir);

  const { slug, rendered } = await ingest(input, type);
  const outPath = path.join(outDir, `${slug}.md`);
  safeWriteFile(outPath, rendered);
  console.log(JSON.stringify({ type, slug, path: outPath }));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
