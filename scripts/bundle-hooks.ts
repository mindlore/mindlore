import { build, Plugin } from 'esbuild';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';

const PROJECT_ROOT = join(__dirname, '..');
const HOOKS_SRC = join(PROJECT_ROOT, 'hooks', 'src');
const HOOKS_OUT = join(PROJECT_ROOT, 'hooks');

const entryPoints = readdirSync(HOOKS_SRC)
  .filter(f => f.startsWith('mindlore-') && f.endsWith('.cjs'))
  .map(f => join(HOOKS_SRC, f));

const SCRIPTS_DIR = join(PROJECT_ROOT, 'dist', 'scripts');
const SYNC_SCRIPTS = ['cc-session-sync.js', 'cc-memory-bulk-sync.js'];

const EXTERNAL_LIBS = ['secure-io'];

const distRedirect: Plugin = {
  name: 'dist-redirect',
  setup(b) {
    b.onResolve({ filter: /dist\/scripts/ }, args => {
      const basename = args.path.split('/').pop()?.replace(/\.js$/, '') ?? '';
      if (EXTERNAL_LIBS.includes(basename)) {
        return { path: `./lib/${basename}.cjs`, external: true };
      }
      const resolved = resolve(args.resolveDir, args.path);
      const fromRoot = resolve(PROJECT_ROOT, 'dist', resolved.split(/dist[/\\]/).pop()!);
      return { path: fromRoot };
    });
  },
};

async function main() {
  const result = await build({
    entryPoints,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outdir: HOOKS_OUT,
    outExtension: { '.js': '.cjs' },
    external: ['better-sqlite3', './lib/secure-io.cjs', './lib/mindlore-common.cjs'],
    plugins: [distRedirect],
    logLevel: 'info',
    minify: false,
    sourcemap: false,
  });

  console.log(`Bundled ${entryPoints.length} hooks → hooks/`);
  if (result.errors.length) {
    console.error('Errors:', result.errors);
    process.exit(1);
  }

  // Bundle sync scripts separately (different source dir → flat output)
  const scriptEntries = SYNC_SCRIPTS
    .map(f => join(SCRIPTS_DIR, f))
    .filter(f => require('fs').existsSync(f));

  if (scriptEntries.length > 0) {
    const r2 = await build({
      entryPoints: scriptEntries,
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      outdir: HOOKS_OUT,
      outExtension: { '.js': '.cjs' },
      external: ['better-sqlite3'],
      logLevel: 'info',
      minify: false,
      sourcemap: false,
    });
    console.log(`Bundled ${scriptEntries.length} sync scripts → hooks/`);
    if (r2.errors.length) {
      console.error('Errors:', r2.errors);
      process.exit(1);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
