import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  estimateContextTokens,
  resultCountFromContext,
  adaptiveResultCount,
  getContextWindow,
} from '../scripts/lib/transcript-token-estimator';

describe('transcript-token-estimator', () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tte-'));
    tmpFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = Array(100)
      .fill('')
      .map(() => JSON.stringify({ role: 'user', content: 'a'.repeat(200) }));
    fs.writeFileSync(tmpFile, lines.join('\n'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.CLAUDE_CONTEXT_WINDOW;
  });

  it('estimates token count from transcript', () => {
    const tokens = estimateContextTokens(tmpFile, { tailLines: 200 });
    expect(tokens).toBeGreaterThan(4000);
    expect(tokens).toBeLessThan(7000);
  });

  it('returns 0 for missing transcript', () => {
    expect(estimateContextTokens(path.join(tmpDir, 'missing.jsonl'))).toBe(0);
  });

  it('caches by mtime', () => {
    const t1 = estimateContextTokens(tmpFile);
    const t2 = estimateContextTokens(tmpFile);
    expect(t1).toBe(t2);
    expect(t1).toBeGreaterThan(0);
  });

  it('maps context % to result count', () => {
    expect(resultCountFromContext(0.40)).toBe(5);
    expect(resultCountFromContext(0.60)).toBe(3);
    expect(resultCountFromContext(0.80)).toBe(2);
    expect(resultCountFromContext(0.95)).toBe(1);
  });

  it('honors CLAUDE_CONTEXT_WINDOW env override', () => {
    process.env.CLAUDE_CONTEXT_WINDOW = '1000000';
    expect(getContextWindow()).toBe(1_000_000);
    delete process.env.CLAUDE_CONTEXT_WINDOW;
    expect(getContextWindow()).toBe(200_000);
  });

  it('ignores invalid CLAUDE_CONTEXT_WINDOW values', () => {
    process.env.CLAUDE_CONTEXT_WINDOW = 'not-a-number';
    expect(getContextWindow()).toBe(200_000);
    process.env.CLAUDE_CONTEXT_WINDOW = '-100';
    expect(getContextWindow()).toBe(200_000);
  });

  it('adaptiveResultCount returns 3 for undefined transcript', () => {
    expect(adaptiveResultCount(undefined)).toBe(3);
  });

  it('adaptiveResultCount returns 5 for low-context transcript', () => {
    process.env.CLAUDE_CONTEXT_WINDOW = '1000000';
    expect(adaptiveResultCount(tmpFile)).toBe(5);
  });
});
