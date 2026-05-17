import { computeRRF, type RankedResult } from '../scripts/lib/rrf';

describe('Multi-Signal RRF', () => {
  test('recall_count high ranks higher (additive boost α=0.3)', () => {
    const porter: RankedResult[] = [
      { slug: 's1', rank: 1, path: '/s1', score: 0 },
      { slug: 's5', rank: 2, path: '/s5', score: 0 },
    ];
    const trigram: RankedResult[] = [
      { slug: 's5', rank: 1, path: '/s5', score: 0 },
      { slug: 's1', rank: 2, path: '/s1', score: 0 },
    ];
    const recallMap = new Map([['s1', 0], ['s5', 30]]);
    const relationGraph = new Map<string, Set<string>>([['s1', new Set()], ['s5', new Set()]]);
    const result = computeRRF(porter, trigram, recallMap, relationGraph);
    expect(result[0]!.slug).toBe('s5'); // recall 30 boost > recall 0
  });

  test('relationProximity intersection cap 3', () => {
    const porter: RankedResult[] = [
      { slug: 's1', rank: 1, path: '/s1', score: 0 },
      { slug: 's2', rank: 2, path: '/s2', score: 0 },
      { slug: 's3', rank: 3, path: '/s3', score: 0 },
    ];
    const trigram: RankedResult[] = [];
    const recallMap = new Map([['s1', 0], ['s2', 0], ['s3', 0]]);
    const relationGraph = new Map<string, Set<string>>([
      ['s1', new Set(['s2'])],  // s1 ↔ s2 cluster
      ['s2', new Set(['s1'])],
      ['s3', new Set()],         // s3 isolated
    ]);
    const result = computeRRF(porter, trigram, recallMap, relationGraph);
    const s1 = result.find(r => r.slug === 's1');
    const s3 = result.find(r => r.slug === 's3');
    expect(s1!.score).toBeGreaterThan(s3!.score);
  });

  test('recall=0 document has no regression — pure rrfBase competes', () => {
    const porter: RankedResult[] = [
      { slug: 'new', rank: 1, path: '/new', score: 0 },
      { slug: 'old', rank: 2, path: '/old', score: 0 },
    ];
    const trigram: RankedResult[] = [];
    const recallMap = new Map([['new', 0], ['old', 30]]);
    const relationGraph = new Map<string, Set<string>>([['new', new Set()], ['old', new Set()]]);
    const result = computeRRF(porter, trigram, recallMap, relationGraph);
    const newRes = result.find(r => r.slug === 'new')!;
    const oldRes = result.find(r => r.slug === 'old')!;
    expect(newRes.score).toBeGreaterThan(0);
    expect(oldRes.score).toBeGreaterThan(newRes.score);
  });

  test('accessBoost formula: log2(recall+1)/5 capped at 1.0', () => {
    const porter: RankedResult[] = [
      { slug: 'low', rank: 1, path: '/low', score: 0 },
      { slug: 'max', rank: 2, path: '/max', score: 0 },
    ];
    const trigram: RankedResult[] = [];
    const recallMap = new Map([['low', 0], ['max', 1000]]);
    const relationGraph = new Map<string, Set<string>>([['low', new Set()], ['max', new Set()]]);
    const result = computeRRF(porter, trigram, recallMap, relationGraph);
    const maxRes = result.find(r => r.slug === 'max')!;
    expect(maxRes.score).toBeGreaterThan(0.3);
  });
});
