import { build, Plugin } from 'esbuild';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';

const PROJECT_ROOT = join(__dirname, '..');
const HOOKS_SRC = join(PROJECT_ROOT, 'hooks', 'src');
const HOOKS_OUT = join(PROJECT_ROOT, 'hooks');

const entryPoints = readdirSync(HOOKS_SRC)
  .filter(f => f.startsWith('mindlore-') && f.endsWith('.cjs'))
  .map(f => join(HOOKS_SRC, f));

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
}

main().catch(e => { console.error(e); process.exit(1); });
