import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const MCP_SERVER_PATH = path.join(__dirname, '..', 'dist', 'scripts', 'mcp-server.js');

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

function sendRequest(proc: ChildProcess, request: JsonRpcRequest): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('MCP response timeout')), 10000);
    let buffer = '';

    const onData = (data: Buffer): void => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse in test context
          const parsed = JSON.parse(line) as JsonRpcResponse;
          if (parsed.id === request.id) {
            clearTimeout(timeout);
            proc.stdout?.removeListener('data', onData);
            resolve(parsed);
            return;
          }
        } catch { /* partial line, keep buffering */ }
      }
      buffer = lines[lines.length - 1] ?? '';
    };

    proc.stdout?.on('data', onData);
    proc.stdin?.write(JSON.stringify(request) + '\n');
  });
}

describe('MCP Server stdio integration', () => {
  let proc: ChildProcess;
  let testDir: string;

  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-mcp-integ-'));
    proc = spawn('node', [MCP_SERVER_PATH], {
      env: { ...process.env, MINDLORE_HOME: testDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  });

  afterAll(() => {
    proc.kill();
    // Windows: wait briefly for process termination before rmSync
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure on Windows EPERM
    }
  });

  it('responds to initialize request', async () => {
    const response = await sendRequest(proc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    });
    expect(response.result).toBeDefined();
    expect(response.error).toBeUndefined();
  });

  it('lists tools', async () => {
    const response = await sendRequest(proc, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    expect(response.result).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test assertion context
    const result = response.result as { tools: Array<{ name: string }> };
    const toolNames = result.tools.map(t => t.name);
    expect(toolNames).toContain('mindlore_search');
    expect(toolNames).toContain('mindlore_stats');
    expect(toolNames).toContain('mindlore_ingest');
    expect(toolNames).toContain('mindlore_recall');
    expect(toolNames).toContain('mindlore_brief');
    expect(toolNames).toContain('mindlore_decide');
    expect(toolNames).toContain('mindlore_relate');
    expect(toolNames).toContain('mindlore_get');
    expect(toolNames).toHaveLength(8);
  });

  it('executes mindlore_stats tool', async () => {
    const response = await sendRequest(proc, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'mindlore_stats',
        arguments: {},
      },
    });
    expect(response.result).toBeDefined();
    expect(response.error).toBeUndefined();
  });

  it('executes mindlore_search with empty results', async () => {
    const response = await sendRequest(proc, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'mindlore_search',
        arguments: { query: 'nonexistent query xyz' },
      },
    });
    expect(response.result).toBeDefined();
    expect(response.error).toBeUndefined();
  });
});
