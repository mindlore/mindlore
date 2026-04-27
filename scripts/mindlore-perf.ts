#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { GLOBAL_MINDLORE_DIR } from './lib/constants.js';

interface TelemetryEntry {
  ts: string;
  hook: string;
  duration_ms: number;
  ok: boolean;
  injected_tokens?: number;
  full_read_tokens?: number;
}

interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  errorCount: number;
  mean: number;
}

export function parseTelemetry(telPath: string): TelemetryEntry[] {
  if (!fs.existsSync(telPath)) return [];
  const lines = fs.readFileSync(telPath, 'utf8').trim().split('\n');
  const entries: TelemetryEntry[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as TelemetryEntry;
      if (parsed.hook && typeof parsed.duration_ms === 'number') {
        entries.push(parsed);
      }
    } catch { /* skip malformed lines */ }
  }
  return entries;
}

export function groupByHook(entries: TelemetryEntry[]): Record<string, TelemetryEntry[]> {
  const groups: Record<string, TelemetryEntry[]> = {};
  for (const e of entries) {
    if (!groups[e.hook]) groups[e.hook] = [];
    groups[e.hook]!.push(e);
  }
  return groups;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

export function calculatePercentiles(entries: TelemetryEntry[], hookName: string): Percentiles {
  const filtered = entries.filter(e => e.hook === hookName);
  if (filtered.length === 0) return { p50: 0, p95: 0, p99: 0, count: 0, errorCount: 0, mean: 0 };

  const durations = filtered.map(e => e.duration_ms).sort((a, b) => a - b);
  const errorCount = filtered.filter(e => !e.ok).length;
  const sum = durations.reduce((a, b) => a + b, 0);

  return {
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    count: filtered.length,
    errorCount,
    mean: Math.round(sum / durations.length),
  };
}

function formatReport(entries: TelemetryEntry[]): string {
  const groups = groupByHook(entries);
  const hooks = Object.keys(groups).sort();

  const lines: string[] = ['Mindlore Performance Report', '='.repeat(40), ''];

  for (const hook of hooks) {
    const percs = calculatePercentiles(entries, hook);
    lines.push(`${hook} (${percs.count} calls, ${percs.errorCount} errors)`);
    lines.push(`  p50: ${percs.p50}ms  p95: ${percs.p95}ms  p99: ${percs.p99}ms  mean: ${percs.mean}ms`);
    lines.push('');
  }

  lines.push(`Total: ${entries.length} entries across ${hooks.length} hooks`);
  return lines.join('\n');
}

function main(): void {
  const telPath = path.join(GLOBAL_MINDLORE_DIR, 'telemetry.jsonl');
  const entries = parseTelemetry(telPath);

  if (entries.length === 0) {
    console.log('No telemetry data found.');
    return;
  }

  const topN = process.argv.includes('--top')
    ? parseInt(process.argv[process.argv.indexOf('--top') + 1] ?? '10', 10)
    : 0;

  if (topN > 0) {
    const sorted = [...entries].sort((a, b) => b.duration_ms - a.duration_ms);
    console.log(`Top ${topN} slowest calls:\n`);
    for (const e of sorted.slice(0, topN)) {
      console.log(`  ${e.hook}: ${e.duration_ms}ms (${e.ok ? 'ok' : 'FAIL'}) @ ${e.ts}`);
    }
    return;
  }

  if (process.argv.includes('--savings')) {
    const withTokens = entries.filter(e => e.injected_tokens && e.full_read_tokens);
    if (withTokens.length === 0) {
      console.log('No savings data found. Hooks need to emit injected_tokens/full_read_tokens.');
      return;
    }
    let totalInjected = 0;
    let totalFull = 0;
    for (const e of withTokens) {
      totalInjected += e.injected_tokens!;
      totalFull += e.full_read_tokens!;
    }
    const saved = totalFull - totalInjected;
    const pct = totalFull > 0 ? ((saved / totalFull) * 100).toFixed(1) : '0';
    console.log(`\nContext Savings Report (${withTokens.length} entries)`);
    console.log('='.repeat(40));
    console.log(`  Full read tokens:     ${totalFull}`);
    console.log(`  Injected tokens:      ${totalInjected}`);
    console.log(`  Tokens saved:         ${saved} (${pct}%)\n`);
    return;
  }

  console.log(formatReport(entries));
}

if (require.main === module) main();
