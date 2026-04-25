import fs from 'fs';
import path from 'path';
import os from 'os';

describe('withTelemetry', () => {
  let baseDir: string;
  let telemetryPath: string;

  beforeEach(() => {
    jest.resetModules();
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tel-'));
    telemetryPath = path.join(baseDir, 'telemetry.jsonl');
    process.env.MINDLORE_HOME = baseDir;
  });

  afterEach(() => {
    delete process.env.MINDLORE_HOME;
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  test('async: writes ts/hook/duration_ms/ok on success', async () => {
    const { withTelemetry } = require('../hooks/lib/mindlore-common.cjs');
    await withTelemetry('test-hook', async () => 42);
    const lines = fs.readFileSync(telemetryPath, 'utf8').trim().split('\n');
    expect(lines.length).toBeGreaterThan(0);
    const row = JSON.parse(lines[0]!);
    expect(row.hook).toBe('test-hook');
    expect(row.ok).toBe(true);
    expect(typeof row.duration_ms).toBe('number');
    expect(typeof row.ts).toBe('string');
  });

  test('async: writes ok=false on throw, does not swallow error', async () => {
    const { withTelemetry } = require('../hooks/lib/mindlore-common.cjs');
    await expect(withTelemetry('bad', async () => { throw new Error('boom'); }))
      .rejects.toThrow('boom');
    const row = JSON.parse(fs.readFileSync(telemetryPath, 'utf8').trim());
    expect(row.ok).toBe(false);
  });

  test('sync: writes telemetry line', () => {
    const { withTelemetrySync } = require('../hooks/lib/mindlore-common.cjs');
    const result = withTelemetrySync('sync-hook', () => 99);
    expect(result).toBe(99);
    const row = JSON.parse(fs.readFileSync(telemetryPath, 'utf8').trim());
    expect(row.hook).toBe('sync-hook');
    expect(row.ok).toBe(true);
  });

  test('telemetry write failure does not crash hook', async () => {
    process.env.MINDLORE_HOME = '/nonexistent/path/that/does/not/exist';
    const { withTelemetry } = require('../hooks/lib/mindlore-common.cjs');
    const result = await withTelemetry('safe', async () => 'survived');
    expect(result).toBe('survived');
  });
});
