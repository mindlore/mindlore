import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('daemon constants', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const constants = require('../dist/scripts/lib/constants.js');

  it('should define DAEMON_PORT_FILE inside mindlore dir', () => {
    expect(constants.DAEMON_PORT_FILE).toContain('mindlore-daemon.port');
  });

  it('should define DAEMON_PID_FILE inside mindlore dir', () => {
    expect(constants.DAEMON_PID_FILE).toContain('mindlore-daemon.pid');
  });

  it('should define DAEMON_TIMEOUT_MS as 300', () => {
    expect(constants.DAEMON_TIMEOUT_MS).toBe(300);
  });

  it('should define DAEMON_HOST as 127.0.0.1', () => {
    expect(constants.DAEMON_HOST).toBe('127.0.0.1');
  });
});

describe('daemon server', () => {
  let createDaemonServer: typeof import('../scripts/lib/daemon.js').createDaemonServer;

  beforeAll(async () => {
    const mod = await import('../scripts/lib/daemon.js');
    createDaemonServer = mod.createDaemonServer;
  });

  it('should start and respond to ping', async () => {
    const server = createDaemonServer({ skipModelLoad: true });
    await server.start();
    const port = server.getPort();
    expect(port).toBeGreaterThan(0);

    const response = await new Promise<string>((resolve) => {
      const client = net.createConnection(port!, '127.0.0.1', () => {
        client.write(JSON.stringify({ type: 'ping' }) + '\n');
      });
      client.on('data', (data) => {
        resolve(data.toString().trim());
        client.end();
      });
    });

    const parsed = JSON.parse(response);
    expect(parsed.type).toBe('pong');
    await server.stop();
  }, 10000);

  it('should respond to embed request with mock embedding', async () => {
    const mockEmbed = new Array(384).fill(0.1);
    const server = createDaemonServer({ skipModelLoad: true, mockEmbedding: mockEmbed });
    await server.start();
    const port = server.getPort()!;

    const response = await new Promise<string>((resolve) => {
      const client = net.createConnection(port, '127.0.0.1', () => {
        client.write(JSON.stringify({ type: 'embed', text: 'test query' }) + '\n');
      });
      client.on('data', (data) => {
        resolve(data.toString().trim());
        client.end();
      });
    });

    const parsed = JSON.parse(response);
    expect(parsed.type).toBe('embedding');
    expect(parsed.embedding).toHaveLength(384);
    await server.stop();
  }, 10000);

  it('should write PID file on start and remove on stop', async () => {
    const pidFile = path.join(os.tmpdir(), `mindlore-test-pid-${Date.now()}`);
    const portFile = path.join(os.tmpdir(), `mindlore-test-port-${Date.now()}`);
    const server = createDaemonServer({ skipModelLoad: true, pidFile, portFile });

    await server.start();
    expect(fs.existsSync(pidFile)).toBe(true);
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
    expect(pid).toBe(process.pid);

    expect(fs.existsSync(portFile)).toBe(true);
    const writtenPort = parseInt(fs.readFileSync(portFile, 'utf8').trim());
    expect(writtenPort).toBe(server.getPort());

    await server.stop();
    expect(fs.existsSync(pidFile)).toBe(false);
    expect(fs.existsSync(portFile)).toBe(false);
  }, 10000);

  it('should report running status', async () => {
    const server = createDaemonServer({ skipModelLoad: true });
    expect(server.isRunning()).toBe(false);
    await server.start();
    expect(server.isRunning()).toBe(true);
    await server.stop();
    expect(server.isRunning()).toBe(false);
  }, 10000);
});
