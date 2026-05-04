import fs from 'fs';
import path from 'path';
import type { McpContext } from '../mcp-tools.js';
import { DB_NAME } from '../constants.js';

interface StatsOutput {
  version: string;
  sources: number;
  episodes: number;
  decisions: number;
  learnings: number;
  dbSize: string;
  lastIndexed: string;
  health: 'ok' | 'warning' | 'error';
  warnings?: string[];
}

const COUNTED_DIRS = ['sources', 'episodes', 'decisions', 'learnings'] as const;

const MODULE_VERSION = (() => {
  try {
    const pkgPath = path.join(__dirname, '..', '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- package.json structure is known
    return (pkg as { version?: string }).version ?? '0.0.0';
  } catch { return '0.0.0'; }
})();

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countDir(dirPath: string): number {
  try {
    return fs.readdirSync(dirPath).filter(f => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

export function handleStats(ctx: McpContext): StatsOutput {
  const warnings: string[] = [];

  const counts = Object.fromEntries(
    COUNTED_DIRS.map(d => [d, countDir(path.join(ctx.baseDir, d))])
  );

  let dbSize = '0 B';
  try {
    dbSize = formatSize(fs.statSync(path.join(ctx.baseDir, DB_NAME)).size);
  } catch { /* ENOENT or other — default 0 B */ }

  let lastIndexed = 'never';
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DB schema guarantees row shape
    const row = ctx.db.prepare(
      'SELECT last_indexed FROM file_hashes ORDER BY last_indexed DESC LIMIT 1'
    ).get() as { last_indexed: string } | undefined;
    if (row) lastIndexed = row.last_indexed;
  } catch { /* table may not exist */ }

  const health = warnings.length === 0 ? 'ok' : 'warning';

  return {
    version: MODULE_VERSION,
    sources: counts.sources ?? 0,
    episodes: counts.episodes ?? 0,
    decisions: counts.decisions ?? 0,
    learnings: counts.learnings ?? 0,
    dbSize,
    lastIndexed,
    health,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
