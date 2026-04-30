import { extractSnippet } from '../scripts/lib/snippet.js';

test('extracts window around query terms', () => {
  const content = 'A'.repeat(100) + ' TypeScript hooks are powerful ' + 'B'.repeat(100);
  const snippet = extractSnippet(content, ['typescript', 'hooks'], 60);
  expect(snippet).toContain('TypeScript hooks');
  expect(snippet.length).toBeLessThanOrEqual(80);
});

test('returns start of content if no term match', () => {
  const content = 'Hello world this is a test document with some words';
  const snippet = extractSnippet(content, ['nonexistent'], 30);
  expect(snippet.startsWith('Hello')).toBe(true);
  expect(snippet.endsWith('...')).toBe(true);
});

test('returns full content if shorter than maxLen', () => {
  const content = 'Short text';
  const snippet = extractSnippet(content, ['short'], 300);
  expect(snippet).toBe('Short text');
});

test('empty content returns empty', () => {
  expect(extractSnippet('', ['test'], 60)).toBe('');
});

test('prefers position with most term matches', () => {
  const content = 'alpha beta ' + 'X'.repeat(200) + ' alpha gamma beta';
  const snippet = extractSnippet(content, ['alpha', 'beta'], 40);
  expect(snippet).toContain('alpha');
  expect(snippet).toContain('beta');
});
