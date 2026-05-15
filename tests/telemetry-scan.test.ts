import path from 'path';
import os from 'os';
import fs from 'fs';
import { scanFailures } from '../scripts/lib/telemetry-scan';

const tmpTelemetry = path.join(os.tmpdir(), `scan-test-${Date.now()}.jsonl`);

afterEach(() => { if (fs.existsSync(tmpTelemetry)) fs.unlinkSync(tmpTelemetry); });

function writeLines(...lines: object[]) {
  fs.writeFileSync(tmpTelemetry, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
}

test('scanFailures returns only entries with ok:false AND failure regex match', () => {
  writeLines(
    { ts: '2026-05-15T10:00:00Z', skill: 's', script: 'a', ok: true, exit_code: 0, output: 'all good' },
    { ts: '2026-05-15T10:01:00Z', skill: 's', script: 'b', ok: false, exit_code: 1, output: 'Error: missing file' },
    { ts: '2026-05-15T10:02:00Z', skill: 's', script: 'c', ok: false, exit_code: 124, output: 'killed' },
    { ts: '2026-05-15T10:03:00Z', skill: 's', script: 'd', ok: true, exit_code: 0, output: 'Error: not found, falling back' },
    { ts: '2026-05-15T10:04:00Z', skill: 's', script: 'e', ok: false, exit_code: 1, output: '    at someFunc (/path/file.js:10)' },
    { ts: '2026-05-15T10:05:00Z', skill: 's', script: 'f', ok: false, exit_code: 1, output: 'Traceback (most recent call last)\n  File "x"' },
  );
  const failures = scanFailures(tmpTelemetry);
  expect(failures).toHaveLength(3);
  expect(failures.map(f => f.script)).toEqual(['b', 'e', 'f']);
});

test('scanFailures respects sinceDate filter', () => {
  writeLines(
    { ts: '2026-05-10T00:00:00Z', skill: 's', script: 'old', ok: false, exit_code: 1, output: 'Error: x' },
    { ts: '2026-05-15T00:00:00Z', skill: 's', script: 'new', ok: false, exit_code: 1, output: 'Error: y' },
  );
  const failures = scanFailures(tmpTelemetry, new Date('2026-05-12T00:00:00Z'));
  expect(failures).toHaveLength(1);
  expect(failures[0]?.script).toBe('new');
});

test('scanFailures handles missing file gracefully', () => {
  const failures = scanFailures('/nonexistent/path.jsonl');
  expect(failures).toEqual([]);
});
