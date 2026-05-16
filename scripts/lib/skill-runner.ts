#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, isAbsolute } from 'path';
import os from 'os';

function telemetryPath(): string {
  if (process.env.MINDLORE_TELEMETRY_PATH) return process.env.MINDLORE_TELEMETRY_PATH;
  return join(os.homedir(), '.mindlore', 'telemetry.jsonl');
}

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
  return base.replace(/\.js$/, '');
}

function resolveProject(): string {
  if (process.env.MINDLORE_PROJECT) return process.env.MINDLORE_PROJECT;
  const cwd = process.cwd();
  const base = cwd.split(/[\\/]/).pop() || 'global';
  return base.toLowerCase();
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
  const entry = {
    ts: new Date().toISOString(),
    skill,
    script: scriptId(scriptPath),
    duration_ms,
    ok: result.status === 0,
    exit_code: result.status ?? -1,
    output: captured.slice(-4000),
  };
  try {
    const p = telemetryPath();
    const dir = dirname(p);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(p, JSON.stringify(entry) + '\n');
  } catch {
    // telemetry write failure should never break skill execution
  }
  process.exit(result.status ?? 1);
}

main();
