import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('telemetry-bridge', () => {
  let tmpDir: string;
  let oldEnv: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tel-bridge-'));
    oldEnv = process.env.MINDLORE_HOME;
    process.env.MINDLORE_HOME = tmpDir;
    delete require.cache[require.resolve('../scripts/lib/telemetry-bridge.cjs')];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (oldEnv) process.env.MINDLORE_HOME = oldEnv;
    else delete process.env.MINDLORE_HOME;
  });

  test('writeTelemetry appends JSON line to telemetry.jsonl', () => {
    const { writeTelemetry } = require('../scripts/lib/telemetry-bridge.cjs');
    writeTelemetry({ ts: '2026-05-17T00:00:00Z', event: 'test', value: 42 });
    const file = path.join(tmpDir, '.mindlore', 'telemetry.jsonl');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toBe('{"ts":"2026-05-17T00:00:00Z","event":"test","value":42}\n');
  });

  test('writeTelemetry appends multiple lines without overwrite', () => {
    const { writeTelemetry } = require('../scripts/lib/telemetry-bridge.cjs');
    writeTelemetry({ event: 'a' });
    writeTelemetry({ event: 'b' });
    const file = path.join(tmpDir, '.mindlore', 'telemetry.jsonl');
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n') as string[];
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toEqual({ event: 'a' });
    expect(JSON.parse(lines[1]!)).toEqual({ event: 'b' });
  });

  test('writeTelemetry rotates at 10MB', () => {
    const { writeTelemetry } = require('../scripts/lib/telemetry-bridge.cjs');
    const file = path.join(tmpDir, '.mindlore', 'telemetry.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const big = 'x'.repeat(11 * 1024 * 1024);
    fs.writeFileSync(file, big);
    writeTelemetry({ event: 'after-rotate' });
    expect(fs.existsSync(path.join(tmpDir, '.mindlore', 'telemetry.jsonl.1'))).toBe(true);
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toBe('{"event":"after-rotate"}\n');
  });

  test('schema-agnostic — accepts arbitrary entry shape', () => {
    const { writeTelemetry } = require('../scripts/lib/telemetry-bridge.cjs');
    writeTelemetry({ foo: 'bar' });
    writeTelemetry({ a: 1, b: { c: 2 } });
    const file = path.join(tmpDir, '.mindlore', 'telemetry.jsonl');
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n') as string[];
    expect(JSON.parse(lines[0]!)).toEqual({ foo: 'bar' });
    expect(JSON.parse(lines[1]!)).toEqual({ a: 1, b: { c: 2 } });
  });
});
