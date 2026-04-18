function jsSkeleton(lines: string[]): string[] {
  const kept: string[] = [];
  let depth = 0;
  let inMLComment = false;

  for (const line of lines) {
    const t = line.trim();

    if (t.includes('/*') && !t.includes('*/')) inMLComment = true;
    if (t.includes('*/')) { inMLComment = false; continue; }
    if (inMLComment) continue;

    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    const keep = depth === 0 && (
      t.startsWith('import ') || t.startsWith('export ') ||
      t.startsWith('const ') || t.startsWith('let ') || t.startsWith('var ') ||
      t.startsWith('function ') || t.startsWith('async function ') ||
      t.startsWith('class ') || t.startsWith('interface ') ||
      t.startsWith('type ') || t.startsWith('enum ') ||
      t.startsWith('//') || t.startsWith('module.exports') ||
      t.startsWith('require(')
    );

    if (keep) {
      kept.push(line);
    } else if (depth === 0 && !t) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('');
    }

    depth = Math.max(0, depth + opens - closes);
  }

  return kept;
}

function pySkeleton(lines: string[]): string[] {
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loop bound ensures index is valid
    const line = lines[i]!;
    const t = line.trim();
    if (!t) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('');
      continue;
    }
    const keep =
      t.startsWith('import ') || t.startsWith('from ') ||
      t.startsWith('def ') || t.startsWith('async def ') ||
      t.startsWith('class ') || t.startsWith('@') ||
      t.startsWith('#') ||
      Boolean(line.match(/^\S/) && t.match(/^[A-Z_][A-Z_0-9]*\s*=/));

    if (keep) {
      kept.push(line);
      if ((t.startsWith('def ') || t.startsWith('class ')) && i + 1 < lines.length) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- i + 1 < lines.length guard above ensures element exists
        const next = lines[i + 1]!.trim();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- same guard: i + 1 < lines.length
        if (next.startsWith('"""') || next.startsWith("'''")) kept.push(lines[i + 1]!);
      }
    }
  }
  return kept;
}

function mdSkeleton(lines: string[]): string[] {
  return lines.filter(l => l.trim().startsWith('#'));
}

export function extractSkeleton(content: string, ext: string): string {
  const lines = content.split('\n');

  let kept: string[];
  switch (ext.toLowerCase()) {
    case 'js': case 'ts': case 'jsx': case 'tsx': case 'mjs': case 'cjs':
      kept = jsSkeleton(lines);
      break;
    case 'py':
      kept = pySkeleton(lines);
      break;
    case 'md': case 'txt': case 'rst':
      kept = mdSkeleton(lines);
      break;
    default:
      return content;
  }

  if (kept.length >= lines.length * 0.75) return content;

  const label = `[SKELETON: ${lines.length} lines -> ${kept.length} shown]`;
  return label + '\n\n' + kept.join('\n').replace(/\n{3,}/g, '\n\n') +
    '\n\n[Full file: ask for specific function/section by name]';
}
