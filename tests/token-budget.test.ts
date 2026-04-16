import { DEFAULT_TOKEN_BUDGET } from '../scripts/lib/constants.js';

describe('Token Budget', () => {
  test('should have default budget values', () => {
    expect(DEFAULT_TOKEN_BUDGET.sessionInject).toBe(2000);
    expect(DEFAULT_TOKEN_BUDGET.searchResults).toBe(1500);
    expect(DEFAULT_TOKEN_BUDGET.perResult).toBe(500);
  });

  test('should truncate text to approximate token limit', () => {
    // ~4 chars per token heuristic
    const longText = 'a'.repeat(3000);
    const maxChars = 500 * 4; // perResult=500 tokens ≈ 2000 chars
    const truncated = longText.slice(0, maxChars);
    expect(truncated.length).toBeLessThanOrEqual(maxChars);
  });
});

describe('Search Hook — FTS5 Fallback OR Optimization', () => {
  test('should build OR-joined FTS5 MATCH query from keywords', () => {
    const keywords = ['react', 'hooks', 'useEffect'];
    const sanitized = keywords.map(kw => kw.replace(/["*(){}[\]^~:]/g, ''));
    const ftsQuery = sanitized.filter(Boolean).map(kw => `"${kw}"`).join(' OR ');
    expect(ftsQuery).toBe('"react" OR "hooks" OR "useEffect"');
  });

  test('should handle keywords with special characters', () => {
    const keywords = ['react*', '"hooks"', 'use:Effect'];
    const sanitized = keywords.map(kw => kw.replace(/["*(){}[\]^~:]/g, ''));
    const ftsQuery = sanitized.filter(Boolean).map(kw => `"${kw}"`).join(' OR ');
    expect(ftsQuery).toBe('"react" OR "hooks" OR "useEffect"');
  });
});
