import path from 'path';
import os from 'os';
import fs from 'fs';
import { spawnSync } from 'child_process';

const tmpTelemetry = path.join(os.tmpdir(), `telemetry-${Date.now()}.jsonl`);
const runner = path.join(__dirname, '..', 'dist', 'scripts', 'lib', 'skill-runner.js');
const echo = path.join(__dirname, 'fixtures', 'echo-script.js');
const fail = path.join(__dirname, 'fixtures', 'fail-script.js');

afterEach(() => { if (fs.existsSync(tmpTelemetry)) fs.unlinkSync(tmpTelemetry); });

test('skill-runner writes telemetry on success', () => {
  const r = spawnSync('node', [runner, 'test-skill', echo, 'hello'], {
    env: { ...process.env, MINDLORE_TELEMETRY_PATH: tmpTelemetry },
    encoding: 'utf8',
  });
  expect(r.status).toBe(0);
  const lines = fs.readFileSync(tmpTelemetry, 'utf8').trim().split('\n');
  expect(lines.length).toBe(1);
  const entry = JSON.parse(lines[0]!);
  expect(entry.skill).toBe('test-skill');
  expect(entry.script).toContain('echo-script');
  expect(entry.ok).toBe(true);
  expect(entry.exit_code).toBe(0);
  expect(typeof entry.duration_ms).toBe('number');
});

test('skill-runner writes telemetry with ok:false on failure', () => {
  const r = spawnSync('node', [runner, 'test-skill', fail], {
    env: { ...process.env, MINDLORE_TELEMETRY_PATH: tmpTelemetry },
    encoding: 'utf8',
  });
  expect(r.status).not.toBe(0);
  const entry = JSON.parse(fs.readFileSync(tmpTelemetry, 'utf8').trim());
  expect(entry.ok).toBe(false);
  expect(entry.exit_code).not.toBe(0);
});

test('skill-runner sets MINDLORE_INVOKING_SKILL for child', () => {
  const probeScript = path.join(os.tmpdir(), `probe-${Date.now()}.js`);
  fs.writeFileSync(probeScript, "console.log(process.env.MINDLORE_INVOKING_SKILL ?? 'NONE'); process.exit(0);");
  try {
    const r = spawnSync('node', [runner, 'my-skill', probeScript], {
      env: { ...process.env, MINDLORE_TELEMETRY_PATH: tmpTelemetry },
      encoding: 'utf8',
    });
    expect(r.stdout).toContain('my-skill');
  } finally {
    fs.unlinkSync(probeScript);
  }
});
