import type { SearchResult } from './search-engine.js';

function findMinSpan(content: string, terms: string[]): number {
  const lower = content.toLowerCase();
  const positions: number[][] = terms.map(t => {
    const pos: number[] = [];
    let idx = lower.indexOf(t);
    while (idx !== -1) {
      pos.push(idx);
      idx = lower.indexOf(t, idx + 1);
    }
    return pos;
  });

  if (positions.some(p => p.length === 0)) return Infinity;

  let minSpan = Infinity;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- positions[0] exists: guarded by `positions.some(p => p.length === 0)` check above
  for (let i = 0; i < positions[0]!.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- positions[0] exists (see above); i is within bounds of its length
    let maxPos = positions[0]![i]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- positions[0] exists (see above); i is within bounds of its length
    let minPos = positions[0]![i]!;

    for (let t = 1; t < terms.length; t++) {
      let bestDist = Infinity;
      let bestPos = 0;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- positions[t] exists: loop t < terms.length, positions has same length as terms
      for (let j = 0; j < positions[t]!.length; j++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- positions[t][j] within loop bounds; positions[0][i] within loop bounds
        const dist = Math.abs(positions[t]![j]! - positions[0]![i]!);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- positions[t][j] within loop bounds
        if (dist < bestDist) { bestDist = dist; bestPos = positions[t]![j]!; }
      }
      if (bestPos > maxPos) maxPos = bestPos;
      if (bestPos < minPos) minPos = bestPos;
    }

    const span = maxPos - minPos;
    if (span < minSpan) minSpan = span;
  }

  return minSpan;
}

export function rerankByProximity(results: SearchResult[], terms: string[]): SearchResult[] {
  if (terms.length < 2) return results;

  return results
    .map(r => {
      const span = findMinSpan(r.content ?? '', terms);
      const boost = span === Infinity ? 1.0 : 1.0 + (1.0 / (1 + span / 50));
      return { ...r, score: r.score * boost };
    })
    .sort((a, b) => b.score - a.score);
}
