export interface ParsedFrontmatter {
  meta: Record<string, string>;
  body: string;
}

// Flat YAML frontmatter parser (string-only values, no nesting/arrays).
// For full YAML use a real parser; this is intentionally minimal for
// mindlore's source frontmatter schema.
export function parseFlatFrontmatter(content: string): ParsedFrontmatter | null {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---', 4);
  if (end < 0) return null;
  const raw = content.slice(4, end);
  const meta: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    const key = m?.[1]; if (m && key !== undefined) meta[key] = (m[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
  }
  return { meta, body: content.slice(end + 4) };
}
