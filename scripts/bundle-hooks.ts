import { build, Plugin } from 'esbuild';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const PROJECT_ROOT = join(__dirname, '..');
const HOOKS_SRC = join(PROJECT_ROOT, 'hooks', 'src');
const HOOKS_OUT = join(PROJECT_ROOT, 'hooks');

const { getSyncScripts } = require('../hooks/lib/sync-scripts.cjs');
const entryPoints = getSyncScripts(HOOKS_SRC);

const SCRIPTS_DIR = join(PROJECT_ROOT, 'dist', 'scripts');
const SYNC_SCRIPTS = existsSync(SCRIPTS_DIR)
  ? readdirSync(SCRIPTS_DIR).filter((f: string) => f.startsWith('cc-') && f.endsWith('.js'))
  : [];

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
      const parts = resolved.split(/dist[/\\]/);
      const rel = parts.length > 1 ? parts.pop() : undefined;
      if (!rel) throw new Error('expected resolved path to contain dist/');
      const fromRoot = resolve(PROJECT_ROOT, 'dist', rel);
      return { path: fromRoot };
    });
  },
};

const BASE_CONFIG = {
  bundle: true,
  platform: 'node' as const,
  target: 'node20',
  format: 'cjs' as const,
  outdir: HOOKS_OUT,
  outExtension: { '.js': '.cjs' },
  logLevel: 'info' as const,
  minify: false,
  sourcemap: false,
};

async function main() {
  const scriptEntries = SYNC_SCRIPTS
    .map(f => join(SCRIPTS_DIR, f))
    .filter(f => require('fs').existsSync(f));

  const builds = [
    build({
      ...BASE_CONFIG,
      entryPoints,
      external: ['better-sqlite3', './lib/secure-io.cjs', './lib/mindlore-common.cjs', './lib/learnings-loader.cjs'],
      plugins: [distRedirect],
    }),
    ...(scriptEntries.length > 0 ? [build({
      ...BASE_CONFIG,
      entryPoints: scriptEntries,
      external: ['better-sqlite3'],
    })] : []),
  ];

  const results = await Promise.all(builds);
  console.log(`Bundled ${entryPoints.length} hooks → hooks/`);
  if (scriptEntries.length > 0) console.log(`Bundled ${scriptEntries.length} sync scripts → hooks/`);

  const errors = results.flatMap(r => r.errors);
  if (errors.length) {
    console.error('Errors:', errors);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
