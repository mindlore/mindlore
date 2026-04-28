import fs from 'fs';
import path from 'path';
import os from 'os';

describe('context savings metric', () => {
  let tmpDir: string;
  let telPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savings-'));
    telPath = path.join(tmpDir, 'telemetry.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses inject_tokens and source_tokens from telemetry', () => {
    const entry = JSON.stringify({
      ts: '2026-04-27T12:00:00Z',
      hook: 'mindlore-session-focus',
      duration_ms: 150,
      ok: true,
      inject_tokens: 500,
      source_tokens: 2000,
    });
    fs.writeFileSync(telPath, entry + '\n');

    const { parseTelemetry } = require('../dist/scripts/mindlore-perf.js');
    const entries = parseTelemetry(telPath);
    expect(entries).toHaveLength(1);
    expect(entries[0].inject_tokens).toBe(500);
    expect(entries[0].source_tokens).toBe(2000);
  });

  it('handles entries without token fields gracefully', () => {
    const entry = JSON.stringify({
      ts: '2026-04-27T12:00:00Z',
      hook: 'mindlore-search',
      duration_ms: 50,
      ok: true,
    });
    fs.writeFileSync(telPath, entry + '\n');

    const { parseTelemetry } = require('../dist/scripts/mindlore-perf.js');
    const entries = parseTelemetry(telPath);
    expect(entries).toHaveLength(1);
    expect(entries[0].inject_tokens).toBeUndefined();
    expect(entries[0].source_tokens).toBeUndefined();
  });

  it('reads legacy field names (injected_tokens / full_read_tokens)', () => {
    const entry = JSON.stringify({
      ts: '2026-04-27T12:00:00Z',
      hook: 'mindlore-session-focus',
      duration_ms: 100,
      ok: true,
      injected_tokens: 300,
      full_read_tokens: 1500,
    });
    fs.writeFileSync(telPath, entry + '\n');

    const { parseTelemetry } = require('../dist/scripts/mindlore-perf.js');
    const entries = parseTelemetry(telPath);
    expect(entries[0].inject_tokens).toBe(300);
    expect(entries[0].source_tokens).toBe(1500);
  });

  it('calculates savings ratio from token fields', () => {
    const entries = [
      { ts: '2026-04-27T12:00:00Z', hook: 'a', duration_ms: 50, ok: true, inject_tokens: 500, source_tokens: 2000 },
      { ts: '2026-04-27T12:01:00Z', hook: 'b', duration_ms: 50, ok: true, inject_tokens: 200, source_tokens: 1000 },
    ];
    fs.writeFileSync(telPath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');

    const { parseTelemetry } = require('../dist/scripts/mindlore-perf.js');
    const parsed = parseTelemetry(telPath);
    const withTokens = parsed.filter((e: { inject_tokens?: number; source_tokens?: number }) => e.inject_tokens && e.source_tokens);
    expect(withTokens).toHaveLength(2);

    let totalInjected = 0;
    let totalFull = 0;
    for (const e of withTokens) {
      if (typeof e === 'object' && e !== null) {
        const entry: Record<string, unknown> = e;
        totalInjected += typeof entry.inject_tokens === 'number' ? entry.inject_tokens : 0;
        totalFull += typeof entry.source_tokens === 'number' ? entry.source_tokens : 0;
      }
    }
    const ratio = 1 - totalInjected / totalFull;
    expect(ratio).toBeCloseTo(0.767, 2);
  });
});
