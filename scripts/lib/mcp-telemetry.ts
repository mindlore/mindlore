import { promises as fsp } from 'fs';
import path from 'path';
import { errMsg } from './err-msg.js';

interface TelemetryEntry {
  ts: string;
  tool: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export function writeMcpTelemetry(baseDir: string, entry: TelemetryEntry): void {
  const telemetryPath = path.join(baseDir, 'telemetry.jsonl');
  fsp.appendFile(telemetryPath, JSON.stringify(entry) + '\n').catch(() => {
    // telemetry write failure is non-fatal
  });
}

export async function withMcpTelemetry<T>(
  baseDir: string,
  toolName: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  const ts = new Date().toISOString();
  try {
    const result = await fn();
    writeMcpTelemetry(baseDir, {
      ts, tool: toolName, durationMs: Date.now() - start, success: true,
    });
    return result;
  } catch (err) {
    writeMcpTelemetry(baseDir, {
      ts, tool: toolName, durationMs: Date.now() - start, success: false, error: errMsg(err),
    });
    throw err;
  }
}
