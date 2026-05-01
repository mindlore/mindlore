console.warn('[DEPRECATED] mindlore daemon will be replaced by MCP Server in v0.7. No new features will be added.');

import fs from 'fs';
import net from 'net';
import { DAEMON_PORT_FILE, DAEMON_PID_FILE, DAEMON_HOST } from './lib/constants.js';
import { createDaemonServer } from './lib/daemon.js';

const command = process.argv[2] ?? 'status';

function isDaemonRunning(): { running: boolean; pid?: number } {
  try {
    const pid = parseInt(fs.readFileSync(DAEMON_PID_FILE, 'utf8').trim());
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    try { fs.unlinkSync(DAEMON_PID_FILE); } catch { /* already gone */ }
    return { running: false };
  }
}

function getPort(): number | null {
  try {
    const p = parseInt(fs.readFileSync(DAEMON_PORT_FILE, 'utf8').trim());
    return isNaN(p) ? null : p;
  } catch {
    return null;
  }
}

function forceCleanup(pid?: number): void {
  if (pid) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
  }
  try { fs.unlinkSync(DAEMON_PID_FILE); } catch { /* ignore */ }
  try { fs.unlinkSync(DAEMON_PORT_FILE); } catch { /* ignore */ }
}

async function start(): Promise<void> {
  const status = isDaemonRunning();
  if (status.running) {
    console.log(`Daemon already running (PID: ${status.pid})`);
    return;
  }

  console.log('Starting embedding daemon...');
  console.log('Loading embedding model (this may take ~16s on first run)...');

  const server = createDaemonServer({
    pidFile: DAEMON_PID_FILE,
    portFile: DAEMON_PORT_FILE,
  });

  await server.start();
  console.log(`Daemon started (PID: ${process.pid}, port: ${server.getPort()})`);
}

async function stop(): Promise<void> {
  const status = isDaemonRunning();
  if (!status.running) {
    console.log('Daemon is not running.');
    return;
  }

  const port = getPort();
  if (!port) {
    forceCleanup(status.pid);
    console.log('Daemon force-stopped (no port file).');
    return;
  }

  return new Promise((resolve) => {
    const client = net.createConnection(port, DAEMON_HOST, () => {
      client.write(JSON.stringify({ type: 'stop' }) + '\n');
    });
    client.on('data', () => {
      console.log('Daemon stopped.');
      client.end();
      resolve();
    });
    client.on('error', () => {
      forceCleanup(status.pid);
      console.log('Daemon force-stopped.');
      resolve();
    });
  });
}

function showStatus(): void {
  const status = isDaemonRunning();
  if (status.running) {
    const port = getPort();
    console.log(`Daemon is running (PID: ${status.pid}, port: ${port ?? 'unknown'})`);
  } else {
    console.log('Daemon is not running.');
  }
}

switch (command) {
  case 'start':
    void start();
    break;
  case 'stop':
    void stop();
    break;
  case 'status':
    showStatus();
    break;
  default:
    console.log('Usage: npx mindlore daemon [start|stop|status]');
}
