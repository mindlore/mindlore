import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('daemon constants', () => {
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

describe('daemon lifecycle edge cases', () => {
  let createDaemonServer: typeof import('../scripts/lib/daemon.js').createDaemonServer;

  beforeAll(async () => {
    const mod = await import('../scripts/lib/daemon.js');
    createDaemonServer = mod.createDaemonServer;
  });

  it('should handle concurrent connections', async () => {
    const server = createDaemonServer({
      skipModelLoad: true,
      mockEmbedding: new Array(384).fill(0.1),
    });
    await server.start();
    const port = server.getPort()!;

    const promises = Array.from({ length: 3 }, () =>
      new Promise<string>((resolve) => {
        const client = net.createConnection(port, '127.0.0.1', () => {
          client.write(JSON.stringify({ type: 'ping' }) + '\n');
        });
        client.on('data', (data) => {
          resolve(data.toString().trim());
          client.end();
        });
      })
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      expect(JSON.parse(r).type).toBe('pong');
    }
    await server.stop();
  }, 10000);

  it('should handle invalid JSON gracefully', async () => {
    const server = createDaemonServer({ skipModelLoad: true });
    await server.start();
    const port = server.getPort()!;

    const response = await new Promise<string>((resolve) => {
      const client = net.createConnection(port, '127.0.0.1', () => {
        client.write('not valid json\n');
      });
      client.on('data', (data) => {
        resolve(data.toString().trim());
        client.end();
      });
    });

    const parsed = JSON.parse(response);
    expect(parsed.type).toBe('error');
    expect(parsed.error).toContain('Invalid JSON');
    await server.stop();
  }, 10000);

  it('should return error for embed without text', async () => {
    const server = createDaemonServer({ skipModelLoad: true });
    await server.start();
    const port = server.getPort()!;

    const response = await new Promise<string>((resolve) => {
      const client = net.createConnection(port, '127.0.0.1', () => {
        client.write(JSON.stringify({ type: 'embed' }) + '\n');
      });
      client.on('data', (data) => {
        resolve(data.toString().trim());
        client.end();
      });
    });

    const parsed = JSON.parse(response);
    expect(parsed.type).toBe('error');
    expect(parsed.error).toContain('No text');
    await server.stop();
  }, 10000);

  it('should handle stop command', async () => {
    const server = createDaemonServer({ skipModelLoad: true });
    await server.start();
    expect(server.isRunning()).toBe(true);
    const port = server.getPort()!;

    const response = await new Promise<string>((resolve) => {
      const client = net.createConnection(port, '127.0.0.1', () => {
        client.write(JSON.stringify({ type: 'stop' }) + '\n');
      });
      client.on('data', (data) => {
        resolve(data.toString().trim());
        client.end();
      });
    });

    expect(JSON.parse(response).type).toBe('stopped');
    // Wait for graceful shutdown
    await new Promise(r => setTimeout(r, 200));
    expect(server.isRunning()).toBe(false);
  }, 10000);
});

describe('daemon CLI registration', () => {
  it('should be registered as CLI subcommand in init.ts', () => {
    const initSource = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'init.ts'), 'utf8'
    );
    expect(initSource).toContain("daemon:");
    expect(initSource).toContain('mindlore-daemon');
  });

  it('mindlore-daemon.ts script should exist', () => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'mindlore-daemon.ts');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });
});
