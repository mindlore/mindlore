import { existsSync, readFileSync } from 'fs';

export interface TelemetryEntry {
  ts: string;
  skill: string;
  script: string;
  duration_ms?: number;
  ok: boolean;
  exit_code?: number;
  output?: string;
}

export interface SkillFailure {
  ts: string;
  skill: string;
  script: string;
  exit_code: number;
  output: string;
}

const FAILURE_REGEX = /^(Error|TypeError|RangeError|SyntaxError|ReferenceError):|^\s+at\s+\S+\s+\(|Traceback \(most recent call last\)/m;

export function isFailure(entry: TelemetryEntry): boolean {
  if (entry.ok !== false) return false;
  const out = entry.output ?? '';
  return FAILURE_REGEX.test(out);
}

export function scanFailures(telemetryPath: string, sinceDate?: Date): SkillFailure[] {
  if (!existsSync(telemetryPath)) return [];
  const raw = readFileSync(telemetryPath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const since = sinceDate ? sinceDate.getTime() : 0;
  const failures: SkillFailure[] = [];
  for (const line of lines) {
    let entry: TelemetryEntry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (since && new Date(entry.ts).getTime() < since) continue;
    if (!isFailure(entry)) continue;
    failures.push({
      ts: entry.ts,
      skill: entry.skill,
      script: entry.script,
      exit_code: entry.exit_code ?? -1,
      output: entry.output ?? '',
    });
  }
  return failures;
}
