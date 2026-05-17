import fs from 'fs';
import path from 'path';
import { extractUrl } from './lib/extractors/url-extractor.js';
import { extractPdf } from './lib/extractors/pdf-extractor.js';
import { extractFile } from './lib/extractors/file-extractor.js';
import { GLOBAL_MINDLORE_DIR } from './lib/constants.js';
import { safeMkdir, safeWriteFile } from './lib/secure-io.js';
import { slugify } from './lib/slugify.js';

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function renderTemplate(templatePath: string, vars: Record<string, unknown>): string {
  const tpl = fs.readFileSync(templatePath, 'utf8');
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
      const rendered = renderTemplate('templates/source-types/url.md', {
        ...ext,
        slug,
        url: ext.canonical_url,
        date: ext.fetched_at,
      });
      return { slug, rendered };
    }
    case 'pdf': {
      const buf = fs.readFileSync(input);
      const ext = await extractPdf(buf);
      const slug = slugify(ext.title);
      const rendered = renderTemplate('templates/source-types/pdf.md', {
        ...ext,
        slug,
        date: ext.ingested_at,
        pageCount: ext.page_count,
      });
      return { slug, rendered };
    }
    case 'file': {
      const content = fs.readFileSync(input, 'utf8');
      const ext = extractFile(input, content);
      const slug = slugify(path.basename(input, path.extname(input)));
      const rendered = renderTemplate('templates/source-types/file.md', {
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
  const type = typeFlag >= 0 ? args[typeFlag + 1]! : detectType(input ?? '');

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
