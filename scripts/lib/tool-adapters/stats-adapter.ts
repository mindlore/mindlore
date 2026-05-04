import fs from 'fs';
import path from 'path';
import type { McpContext } from '../mcp-tools.js';
import { DB_NAME } from '../constants.js';

interface StatsInput {
  [key: string]: never;
}

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

export function handleStats(ctx: McpContext, input: StatsInput): StatsOutput {
  void input; // no params currently
  const warnings: string[] = [];

  const sources = countDir(path.join(ctx.baseDir, 'sources'));
  const episodes = countDir(path.join(ctx.baseDir, 'episodes'));
  const decisions = countDir(path.join(ctx.baseDir, 'decisions'));
  const learnings = countDir(path.join(ctx.baseDir, 'learnings'));

  let dbSize = '0 B';
  try {
    const dbPath = path.join(ctx.baseDir, DB_NAME);
    if (fs.existsSync(dbPath)) {
      dbSize = formatSize(fs.statSync(dbPath).size);
    }
  } catch { /* ignore */ }

  let lastIndexed = 'never';
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DB schema guarantees row shape
    const row = ctx.db.prepare(
      'SELECT last_indexed FROM file_hashes ORDER BY last_indexed DESC LIMIT 1'
    ).get() as { last_indexed: string } | undefined;
    if (row) lastIndexed = row.last_indexed;
  } catch { /* table may not exist */ }

  let version = '0.0.0';
  try {
    const pkgPath = path.join(__dirname, '..', '..', '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- package.json structure is known
    version = (pkg as { version?: string }).version ?? '0.0.0';
  } catch { /* ignore */ }

  const health = warnings.length === 0 ? 'ok' : 'warning';

  return { version, sources, episodes, decisions, learnings, dbSize, lastIndexed, health, warnings: warnings.length > 0 ? warnings : undefined };
}
