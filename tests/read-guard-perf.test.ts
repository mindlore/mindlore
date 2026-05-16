import { describe, it, expect } from '@jest/globals';
import { runReadGuard } from '../scripts/lib/read-guard-core';

describe('read-guard performance', () => {
  it('completes within 30ms budget for cached path', () => {
    const input = { filePath: '/tmp/test-read.txt', basename: 'test-read.txt' };
    const reads: Record<string, { count?: number; tokens?: number; chars?: number } | number> = {};
    runReadGuard(input, reads);
    const start = Date.now();
    runReadGuard(input, reads);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30);
  });

  it('blocks on 3rd read', () => {
    const input = { filePath: '/tmp/test-read.txt', basename: 'test-read.txt' };
    const reads: Record<string, { count?: number; tokens?: number; chars?: number } | number> = {};
    runReadGuard(input, reads);
    runReadGuard(input, reads);
    const decision = runReadGuard(input, reads);
    expect(decision.block).toBe(true);
  });

  it('warns on 2nd read', () => {
    const input = { filePath: '/tmp/test-read.txt', basename: 'test-read.txt' };
    const reads: Record<string, { count?: number; tokens?: number; chars?: number } | number> = {};
    runReadGuard(input, reads);
    const decision = runReadGuard(input, reads);
    expect(decision.additionalContext).toContain('2. kez okunuyor');
  });
});
