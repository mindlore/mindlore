export function extractSnippet(content: string, terms: string[], maxLen = 300): string {
  if (!content || content.length <= maxLen) return content;

  const lower = content.toLowerCase();
  let bestPos = 0;
  let bestScore = 0;

  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1) {
      const windowStart = Math.max(0, idx - Math.floor(maxLen / 2));
      const windowEnd = Math.min(lower.length, idx + Math.floor(maxLen / 2));
      const window = lower.slice(windowStart, windowEnd);
      const termCount = terms.filter(t => window.includes(t.toLowerCase())).length;
      if (termCount > bestScore) {
        bestScore = termCount;
        bestPos = idx;
      }
    }
  }

  const start = Math.max(0, bestPos - Math.floor(maxLen / 3));
  const end = Math.min(content.length, start + maxLen);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}
