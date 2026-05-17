import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { slugify } from './lib/slugify';

const DIR_TO_TYPE: Record<string, string> = {
  raw: 'raw',
  sources: 'source',
  domains: 'domain',
  analyses: 'analysis',
  insights: 'insight',
  connections: 'connection',
  learnings: 'lesson',
  diary: 'diary',
  decisions: 'decision',
  memory: 'memory',
};

const SCAN_DIRS = Object.keys(DIR_TO_TYPE);

export interface MigrateOptions {
  apply: boolean;
  backupDir: string;
  home?: string;
  reindex?: boolean;
}

export interface MigrateResult {
  written: number;
  skipped: number;
  errors: number;
  byCategory: { missingSlug: number; invalidSlugFormat: number; typeDirMismatch: number };
  samples: string[];
}

function parseFrontmatter(content: string): { fm: Record<string, string>; body: string } | null {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---', 4);
  if (end < 0) return null;
  const raw = content.slice(4, end);
  const fm: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (m) fm[m[1] as string] = (m[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
  }
  return { fm, body: content.slice(end + 4) };
}

function serializeFrontmatter(fm: Record<string, string>, body: string): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) lines.push(`${k}: ${v}`);
  lines.push('---');
  return lines.join('\n') + body;
}

function backupHome(home: string, backupDir: string): void {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(backupDir, `mindlore-backup-${ts}`);
  fs.mkdirSync(dest, { recursive: true });
  for (const dir of SCAN_DIRS) {
    const src = path.join(home, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(dest, dir), { recursive: true });
    }
  }
}

export async function migrateFrontmatter(opts: MigrateOptions): Promise<MigrateResult> {
  const home = opts.home ?? process.env.MINDLORE_HOME ?? path.join(os.homedir(), '.mindlore');
  const result: MigrateResult = {
    written: 0,
    skipped: 0,
    errors: 0,
    byCategory: { missingSlug: 0, invalidSlugFormat: 0, typeDirMismatch: 0 },
    samples: [],
  };

  if (opts.apply) {
    fs.mkdirSync(opts.backupDir, { recursive: true });
    backupHome(home, opts.backupDir);
  }

  function processFile(filePath: string, topDir: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = parseFrontmatter(content);
      if (!parsed) {
        result.skipped++;
        return;
      }
      const { fm, body } = parsed;
      let changed = false;
      const base = path.basename(filePath, '.md');

      if (!fm.slug) {
        fm.slug = slugify(base);
        result.byCategory.missingSlug++;
        changed = true;
      } else if (!/^[a-z0-9-]+$/.test(fm.slug)) {
        fm.slug = slugify(fm.slug);
        result.byCategory.invalidSlugFormat++;
        changed = true;
      }

      const expectedType = DIR_TO_TYPE[topDir];
      if (expectedType && fm.type && fm.type !== expectedType) {
        fm.type = expectedType;
        result.byCategory.typeDirMismatch++;
        changed = true;
      }

      if (changed) {
        if (opts.apply) {
          fs.writeFileSync(filePath, serializeFrontmatter(fm, body));
        }
        result.written++;
        if (result.samples.length < 5) result.samples.push(filePath);
      } else {
        result.skipped++;
      }
    } catch {
      result.errors++;
    }
  }

  function walk(dir: string, topDir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p, topDir);
      else if (f.endsWith('.md')) processFile(p, topDir);
    }
  }

  for (const dir of SCAN_DIRS) {
    walk(path.join(home, dir), dir);
  }

  console.log(`Frontmatter migration ${opts.apply ? 'APPLIED' : 'DRY-RUN'}`);
  console.log(`  missingSlug:       ${result.byCategory.missingSlug}`);
  console.log(`  invalidSlugFormat: ${result.byCategory.invalidSlugFormat}`);
  console.log(`  typeDirMismatch:   ${result.byCategory.typeDirMismatch}`);
  console.log(`  written: ${result.written}, skipped: ${result.skipped}, errors: ${result.errors}`);

  if (opts.apply && result.written > 0 && opts.reindex !== false) {
    console.log('Triggering FTS5 re-index...');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('child_process').execSync('npm run index', { stdio: 'inherit', cwd: process.cwd() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Re-index failed, run `npm run index` manually:', msg);
    }
  }

  return result;
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  const backupDir = path.join(os.homedir(), '.mindlore-backup');
  migrateFrontmatter({ apply, backupDir, reindex: true }).then(r => {
    process.exit(r.errors > 0 ? 1 : 0);
  });
}
