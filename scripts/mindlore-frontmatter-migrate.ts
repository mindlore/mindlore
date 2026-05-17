// NOTE: Frontmatter parser assumes flat-string-only schema (no nested arrays/objects,
// no multiline scalars, no embedded colons within unquoted values). Mindlore's
// canonical frontmatter conforms to this. If you have custom frontmatter with
// nested structures, run with --dry-run first and inspect output.
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { slugify } from './lib/slugify';
import { parseFlatFrontmatter } from './lib/frontmatter';

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
  fixTypeMismatch?: boolean;
}

export interface MigrateResult {
  written: number;
  skipped: number;
  errors: number;
  errorMessages: string[];
  byCategory: { missingSlug: number; invalidSlugFormat: number; typeDirMismatch: number };
  samples: string[];
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
    errorMessages: [],
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
      const parsed = parseFlatFrontmatter(content);
      if (!parsed) {
        result.skipped++;
        return;
      }
      const { meta: fm, body } = parsed;
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
        result.byCategory.typeDirMismatch++;
        if (opts.fixTypeMismatch) {
          fm.type = expectedType;
          changed = true;
        }
      }

      if (changed) {
        if (opts.apply) {
          const tmpPath = filePath + '.tmp';
          fs.writeFileSync(tmpPath, serializeFrontmatter(fm, body));
          fs.renameSync(tmpPath, filePath);
        }
        result.written++;
        if (result.samples.length < 5) result.samples.push(filePath);
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors++;
      if (result.errorMessages.length < 10) {
        result.errorMessages.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  function walk(dir: string, topDir: string): void {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, topDir);
      else if (entry.name.endsWith('.md')) processFile(p, topDir);
    }
  }

  for (const dir of SCAN_DIRS) {
    walk(path.join(home, dir), dir);
  }

  console.log(`Frontmatter migration ${opts.apply ? 'APPLIED' : 'DRY-RUN'}`);
  console.log(`  missingSlug:       ${result.byCategory.missingSlug}`);
  console.log(`  invalidSlugFormat: ${result.byCategory.invalidSlugFormat}`);
  if (opts.fixTypeMismatch) {
    console.log(`  typeDirMismatch:   ${result.byCategory.typeDirMismatch}`);
  } else {
    console.log(`  typeDirMismatch:   ${result.byCategory.typeDirMismatch} (use --fix-type-mismatch to rewrite)`);
  }
  console.log(`  written: ${result.written}, skipped: ${result.skipped}, errors: ${result.errors}`);
  if (!opts.apply) {
    console.log('Note: parser assumes flat string-only frontmatter. Verify with --dry-run before --apply.');
  }

  if (opts.apply && result.written > 0 && opts.reindex !== false) {
    console.log('Triggering FTS5 re-index...');
    try {
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
  const fixTypeMismatch = process.argv.includes('--fix-type-mismatch');
  const backupDir = path.join(os.homedir(), '.mindlore-backup');
  migrateFrontmatter({ apply, backupDir, reindex: true, fixTypeMismatch }).then(r => {
    process.exit(r.errors > 0 ? 1 : 0);
  });
}
