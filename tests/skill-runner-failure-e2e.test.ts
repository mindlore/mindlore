/**
 * E2E: skill-runner → telemetry.jsonl → scanFailures pipeline.
 *
 * Unit tests synthesize telemetry entries with `output` fields, which masks
 * the bug where skill-runner's stdio: 'inherit' never captured child output.
 * This test exercises the real emitter and asserts scanFailures finds a
 * matching failure entry.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { scanFailures } from '../scripts/lib/telemetry-scan';

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(REPO_ROOT, 'dist', 'scripts', 'lib', 'skill-runner.js');
const FAIL_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'fail-script.js');
const ECHO_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'echo-script.js');

let telPath: string;

beforeEach(() => {
  telPath = path.join(os.tmpdir(), `mindlore-rt-tel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jsonl`);
});

afterEach(() => {
  if (fs.existsSync(telPath)) fs.unlinkSync(telPath);
});

function runSkill(scriptPath: string): { exitCode: number | null } {
  const result = spawnSync('node', [RUNNER, 'e2e-skill', scriptPath], {
    env: { ...process.env, MINDLORE_TELEMETRY_PATH: telPath },
    encoding: 'utf-8',
  });
  return { exitCode: result.status };
}

test('skill-runner captures child stderr into telemetry entry output', () => {
  const { exitCode } = runSkill(FAIL_FIXTURE);
  expect(exitCode).not.toBe(0);
  expect(fs.existsSync(telPath)).toBe(true);
  const lines = fs.readFileSync(telPath, 'utf8').trim().split('\n');
  expect(lines).toHaveLength(1);
  const entry = JSON.parse(lines[0]!);
  expect(entry.ok).toBe(false);
  expect(typeof entry.output).toBe('string');
  expect(entry.output).toMatch(/Error: intentional failure/);
});

test('scanFailures detects failures emitted by real skill-runner pipeline', () => {
  runSkill(ECHO_FIXTURE);
  runSkill(FAIL_FIXTURE);
  const failures = scanFailures(telPath);
  expect(failures).toHaveLength(1);
  expect(failures[0]!.skill).toBe('e2e-skill');
  expect(failures[0]!.script).toBe('fail-script');
  expect(failures[0]!.output).toMatch(/Error: intentional failure/);
});

test('successful skill execution does not produce a failure record', () => {
  const { exitCode } = runSkill(ECHO_FIXTURE);
  expect(exitCode).toBe(0);
  const failures = scanFailures(telPath);
  expect(failures).toHaveLength(0);
});
