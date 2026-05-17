import { describe, test, expect } from '@jest/globals';
import { buildSessionMarkdown } from '../scripts/cc-session-sync';

describe('cc-session-sync slug field (B4-b Part A)', () => {
  test('frontmatter includes slug field', () => {
    const fakeMeta = { date: '2026-05-17', startTime: '14:00', branch: 'main' };
    const fakeMessages = [{ type: 'user', message: { role: 'user', content: 'hi' } }];
    const result = buildSessionMarkdown(fakeMessages, fakeMeta, 'test-project', 'abc123', false);
    expect(result.md).toMatch(/^slug: session-2026-05-17-abc123$/m);
  });
});
