import net from 'net';
import fs from 'fs';
import { DAEMON_HOST } from './constants.js';

interface DaemonOptions {
  pidFile?: string;
  portFile?: string;
  skipModelLoad?: boolean;
  mockEmbedding?: number[];
}

interface DaemonRequest {
  type: 'ping' | 'embed' | 'stop';
  text?: string;
}

interface DaemonResponse {
  type: 'pong' | 'embedding' | 'error' | 'stopped';
  embedding?: number[];
  error?: string;
}

interface DaemonServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
  getPort: () => number | null;
}

export function createDaemonServer(options: DaemonOptions): DaemonServer {
  let server: net.Server | null = null;
  let port: number | null = null;
  let embedFn: ((text: string) => Promise<number[]>) | null = null;

  async function loadModel(): Promise<void> {
    if (options.skipModelLoad) {
      embedFn = async () => options.mockEmbedding ?? new Array(384).fill(0);
      return;
    }
    const { generateEmbedding } = await import('./embedding.js');
    embedFn = generateEmbedding;
  }

  async function handleRequest(req: DaemonRequest): Promise<DaemonResponse> {
    switch (req.type) {
      case 'ping':
        return { type: 'pong' };
      case 'embed': {
        if (!embedFn) return { type: 'error', error: 'Model not loaded' };
        if (!req.text) return { type: 'error', error: 'No text provided' };
        try {
          const embedding = await embedFn(req.text);
          return { type: 'embedding', embedding };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          return { type: 'error', error: msg };
        }
      }
      case 'stop':
        return { type: 'stopped' };
      default:
        return { type: 'error', error: 'Unknown request type' };
    }
  }

  const instance: DaemonServer = {
    async start(): Promise<void> {
      await loadModel();

      return new Promise((resolve) => {
        server = net.createServer((conn) => {
          let buffer = '';
          conn.on('data', async (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const req: DaemonRequest = JSON.parse(line);
                const res = await handleRequest(req);
                conn.write(JSON.stringify(res) + '\n');

                if (req.type === 'stop') {
                  setTimeout(() => { void instance.stop(); }, 100);
                }
              } catch {
                conn.write(JSON.stringify({ type: 'error', error: 'Invalid JSON' } satisfies DaemonResponse) + '\n');
              }
            }
          });
        });

        server.listen(0, DAEMON_HOST, () => {
          const addr = server?.address();
          if (addr && typeof addr === 'object') {
            port = addr.port;
          }

          if (options.portFile) {
            fs.writeFileSync(options.portFile, String(port), 'utf8');
          }
          if (options.pidFile) {
            fs.writeFileSync(options.pidFile, String(process.pid), 'utf8');
          }
          resolve();
        });
      });
    },

    async stop(): Promise<void> {
      return new Promise((resolve) => {
        if (options.pidFile && fs.existsSync(options.pidFile)) {
          fs.unlinkSync(options.pidFile);
        }
        if (options.portFile && fs.existsSync(options.portFile)) {
          fs.unlinkSync(options.portFile);
        }
        if (server) {
          server.close(() => {
            server = null;
            port = null;
            resolve();
          });
        } else {
          resolve();
        }
      });
    },

    isRunning(): boolean {
      return server !== null && server.listening;
    },

    getPort(): number | null {
      return port;
    },
  };

  return instance;
}
