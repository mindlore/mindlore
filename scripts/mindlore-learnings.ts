import * as fs from 'fs';
import * as path from 'path';
import { resolveMindloreHome } from './lib/constants.js';

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let curr: number[] = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n] ?? 0;
}

export function showLearning(baseDir: string, slug: string): string {
  const dir = path.join(baseDir, 'learnings');
  const file = path.join(dir, `${slug}.md`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const candidates = fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
  const closest = candidates.map(c => ({ c, d: levenshtein(slug, c) })).sort((a, b) => a.d - b.d)[0];
  throw new Error(`learning not found: ${slug}. closest match: ${closest?.c ?? 'none'}`);
}

export function listLearnings(baseDir: string): { slug: string; firstLine: string }[] {
  const dir = path.join(baseDir, 'learnings');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const slug = f.replace(/\.md$/, '');
    const firstLine = fs.readFileSync(path.join(dir, f), 'utf8').split('\n', 1)[0] ?? '';
    return { slug, firstLine };
  });
}

function main(): void {
  const [, , cmd, slug] = process.argv;
  const baseDir = resolveMindloreHome();
  if (cmd === 'show' && slug) {
    try { process.stdout.write(showLearning(baseDir, slug)); }
    catch (err) { process.stderr.write(`${(err as Error).message}\n`); process.exit(1); }
  } else if (cmd === 'list') {
    for (const { slug, firstLine } of listLearnings(baseDir)) {
      process.stdout.write(`${slug}: ${firstLine}\n`);
    }
  } else {
    process.stderr.write('usage: mindlore-learnings show <slug> | list\n');
    process.exit(2);
  }
}

if (require.main === module) main();
