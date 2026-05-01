import { chunkMarkdown } from '../scripts/lib/chunker.js';

test('splits by headings', () => {
  const md = '# Title\nIntro text\n## Section A\nContent A\n## Section B\nContent B';
  const chunks = chunkMarkdown(md);
  expect(chunks.length).toBe(3);
  expect(chunks[0]!.heading).toBe('# Title');
  expect(chunks[1]!.heading).toBe('## Section A');
  expect(chunks[2]!.heading).toBe('## Section B');
});

test('preserves code block integrity', () => {
  const md = '# Doc\n```\n# not a heading\ncode\n```\n## Real Section\ntext';
  const chunks = chunkMarkdown(md);
  expect(chunks.length).toBe(2);
  expect(chunks[0]!.content).toContain('# not a heading');
});

test('no heading = single chunk', () => {
  const md = 'Just plain text\nwith no headings at all';
  const chunks = chunkMarkdown(md);
  expect(chunks.length).toBe(1);
  expect(chunks[0]!.heading).toBeNull();
});

test('oversized chunk gets split', () => {
  const bigContent = 'x '.repeat(6000);
  const md = '# Big\n' + bigContent;
  const chunks = chunkMarkdown(md, { maxChunkChars: 10000 });
  expect(chunks.length).toBeGreaterThan(1);
});

test('breadcrumb tracks heading hierarchy', () => {
  const md = '# Root\n## Child\n### Grandchild\ntext';
  const chunks = chunkMarkdown(md);
  const last = chunks[chunks.length - 1];
  expect(last!.breadcrumb).toBe('# Root > ## Child > ### Grandchild');
});

test('empty content returns empty array', () => {
  const chunks = chunkMarkdown('');
  expect(chunks.length).toBe(0);
});
