import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { estimateTokens } from '../scripts/lib/estimator';

describe('Estimator real-shape calibration (RT-2)', () => {
  const fixturePath = path.join(__dirname, 'fixtures/real-cc-transcript.jsonl');

  test('real transcript estimates within ±20% of expected tokens (direct count, fixture < TAIL_BYTES)', () => {
    if (!fs.existsSync(fixturePath)) {
      console.warn('Fixture missing — RT-2 calibration skipped');
      return;
    }
    const fileSize = fs.statSync(fixturePath).size;
    const tokens = estimateTokens(fixturePath);
    // Expected ratio: ~0.25 tokens/byte → 5MB = 1.25M tokens
    const expectedTokens = fileSize * 0.25;
    const lowerBound = expectedTokens * 0.8;
    const upperBound = expectedTokens * 1.2;
    expect(tokens).toBeGreaterThan(lowerBound);
    expect(tokens).toBeLessThan(upperBound);
  });

  test('memory usage stays under 100MB during estimation', () => {
    if (!fs.existsSync(fixturePath)) return;
    const before = process.memoryUsage().heapUsed;
    estimateTokens(fixturePath);
    const after = process.memoryUsage().heapUsed;
    const delta = (after - before) / (1024 * 1024);
    expect(delta).toBeLessThan(100); // < 100MB heap delta
  });
});
