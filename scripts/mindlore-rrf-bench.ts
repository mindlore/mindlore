import { computeRRF, type RankedResult } from './lib/rrf.js';

function generateResults(n: number): RankedResult[] {
  return Array.from({ length: n }, (_, i) => ({
    slug: `slug-${i}`,
    rank: i + 1,
    path: `/path/${i}.md`,
    score: 0,
    description: `Description ${i}`,
    title: `Title ${i}`,
    category: 'sources',
    tags: 'tag1,tag2',
    content: 'x'.repeat(200),
  }));
}

const sizes = [20, 50, 100, 500];
for (const n of sizes) {
  const porter = generateResults(n);
  const trigram = generateResults(n);
  const iterations = 1000;

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    computeRRF(porter, trigram, { dedupByPath: true });
  }
  const elapsed = performance.now() - start;
  const perOp = elapsed / iterations;

  console.log(`N=${n}: ${perOp.toFixed(3)}ms/op (${iterations} iterations, total ${elapsed.toFixed(0)}ms)`);
}
