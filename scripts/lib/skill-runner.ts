#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';
import {
  resolveProject,
  TELEMETRY_OUTPUT_MAX_BYTES,
} from './constants.js';

function resolveScript(arg: string): string {
  if (isAbsolute(arg) && existsSync(arg)) return arg;
  const distDir = join(__dirname, '..');
  const guessed = join(distDir, arg.endsWith('.js') ? arg : `${arg}.js`);
  if (existsSync(guessed)) return guessed;
  if (existsSync(arg)) return arg;
  return arg;
}

function scriptId(scriptPath: string): string {
  const base = scriptPath.split(/[\\/]/).pop() ?? scriptPath;
  return base.replace(/\.(js|cjs|mjs|ts)$/, '');
}

function resolveTelemetryBridge(): string {
  const local = join(__dirname, 'telemetry-bridge.cjs');
  if (existsSync(local)) return local;
  return join(__dirname, '..', '..', '..', 'scripts', 'lib', 'telemetry-bridge.cjs');
}

function writeTelemetry(entry: object): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writeTelemetry: bridgeWrite } = require(resolveTelemetryBridge());
  try { bridgeWrite(entry); } catch (_e) { /* graceful */ }
}

function main(): void {
  const [, , skill, scriptArg, ...args] = process.argv;
  if (!skill || !scriptArg) {
    process.stderr.write('usage: skill-runner <skill-name> <script> [args...]\n');
    process.exit(2);
  }
  const scriptPath = resolveScript(scriptArg);
  const project = resolveProject();
  const start = Date.now();
  const result = spawnSync('node', [scriptPath, ...args], {
    env: { ...process.env, MINDLORE_INVOKING_SKILL: skill, MINDLORE_PROJECT: project },
    encoding: 'utf-8',
  });
  const duration_ms = Date.now() - start;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const captured = (result.stderr ?? '') + (result.stdout ?? '');
  writeTelemetry({
    ts: new Date().toISOString(),
    skill,
    script: scriptId(scriptPath),
    duration_ms,
    ok: result.status === 0,
    exit_code: result.status ?? -1,
    output: captured.slice(-TELEMETRY_OUTPUT_MAX_BYTES),
  });
  process.exit(result.status ?? 1);
}

main();
