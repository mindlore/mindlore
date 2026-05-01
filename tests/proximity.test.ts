import { rerankByProximity } from '../scripts/lib/proximity.js';
import type { SearchResult } from '../scripts/lib/search-engine.js';

test('boosts results where terms are adjacent', () => {
  const results: SearchResult[] = [
    { slug: 'a', path: '/a', title: '', description: '', category: '', tags: '', score: 1.0, content: 'TypeScript hooks are powerful tools' },
    { slug: 'b', path: '/b', title: '', description: '', category: '', tags: '', score: 1.0, content: 'TypeScript is great. Much later: hooks pattern' },
  ];
  const reranked = rerankByProximity(results, ['typescript', 'hooks']);
  expect(reranked[0]!.slug).toBe('a');
});

test('single term query — no reranking', () => {
  const results: SearchResult[] = [
    { slug: 'a', path: '/a', title: '', description: '', category: '', tags: '', score: 2.0, content: 'x' },
    { slug: 'b', path: '/b', title: '', description: '', category: '', tags: '', score: 1.0, content: 'y' },
  ];
  const reranked = rerankByProximity(results, ['single']);
  expect(reranked[0]!.slug).toBe('a');
});

test('empty results returns empty', () => {
  expect(rerankByProximity([], ['a', 'b'])).toEqual([]);
});

test('missing content treated as no match', () => {
  const results: SearchResult[] = [
    { slug: 'a', path: '/a', title: '', description: '', category: '', tags: '', score: 1.0 },
  ];
  const reranked = rerankByProximity(results, ['foo', 'bar']);
  expect(reranked).toHaveLength(1);
  expect(reranked[0]!.score).toBe(1.0);
});
