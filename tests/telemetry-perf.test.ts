import fs from 'fs';
import path from 'path';
import os from 'os';

describe('mindlore-perf', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-test-'));
  const telPath = path.join(tmpDir, 'telemetry.jsonl');

  beforeAll(() => {
    const entries = [
      { ts: new Date().toISOString(), hook: 'search', duration_ms: 50, ok: true },
      { ts: new Date().toISOString(), hook: 'search', duration_ms: 200, ok: true },
      { ts: new Date().toISOString(), hook: 'search', duration_ms: 500, ok: true },
      { ts: new Date().toISOString(), hook: 'session-focus', duration_ms: 100, ok: true },
      { ts: new Date().toISOString(), hook: 'session-focus', duration_ms: 800, ok: false },
    ];
    fs.writeFileSync(telPath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
  });

  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('parses telemetry entries', () => {
    const { parseTelemetry } = require('../dist/scripts/mindlore-perf.js');
    const entries = parseTelemetry(telPath);
    expect(entries).toHaveLength(5);
  });

  it('calculates p50/p95 per hook', () => {
    const { parseTelemetry, calculatePercentiles } = require('../dist/scripts/mindlore-perf.js');
    const entries = parseTelemetry(telPath);

    const percs = calculatePercentiles(entries, 'search');
    expect(percs.p50).toBe(200);
    expect(percs.count).toBe(3);
  });

  it('calculates percentiles for session-focus', () => {
    const { parseTelemetry, calculatePercentiles } = require('../dist/scripts/mindlore-perf.js');
    const entries = parseTelemetry(telPath);

    const percs = calculatePercentiles(entries, 'session-focus');
    expect(percs.count).toBe(2);
    expect(percs.errorCount).toBe(1);
  });

  it('returns zero percentiles for unknown hook', () => {
    const { parseTelemetry, calculatePercentiles } = require('../dist/scripts/mindlore-perf.js');
    const entries = parseTelemetry(telPath);

    const percs = calculatePercentiles(entries, 'nonexistent');
    expect(percs.count).toBe(0);
    expect(percs.p50).toBe(0);
  });

  it('groups entries by hook name', () => {
    const { parseTelemetry, groupByHook } = require('../dist/scripts/mindlore-perf.js');
    const entries = parseTelemetry(telPath);
    const groups = groupByHook(entries);
    expect(Object.keys(groups)).toHaveLength(2);
    expect(groups['search']).toHaveLength(3);
    expect(groups['session-focus']).toHaveLength(2);
  });

  it('withTelemetry works when fn returns undefined (S1 regression)', async () => {
    const commonPath = require.resolve('../hooks/lib/mindlore-common.cjs');
    delete require.cache[commonPath];
    const { withTelemetry } = require(commonPath);
    const fn = () => { /* no return — most hooks do this */ };
    await expect(withTelemetry('test-no-return', fn)).resolves.not.toThrow();
  });
});
