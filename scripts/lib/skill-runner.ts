#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import {
  resolveProject,
  resolveTelemetryPath,
  TELEMETRY_FILE_ROTATE_BYTES,
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

function rotateIfNeeded(p: string): void {
  try {
    const size = statSync(p).size;
    if (size >= TELEMETRY_FILE_ROTATE_BYTES) {
      renameSync(p, `${p}.1`);
    }
  } catch { /* file may not exist yet; ENOENT is fine */ }
}

function writeTelemetry(entry: object): void {
  try {
    const p = resolveTelemetryPath();
    const dir = dirname(p);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    rotateIfNeeded(p);
    appendFileSync(p, JSON.stringify(entry) + '\n');
  } catch (err) {
    // telemetry write failure must not break skill execution; surface once to stderr
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[skill-runner] telemetry write failed: ${msg}\n`);
  }
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
