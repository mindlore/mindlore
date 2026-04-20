import fs from 'fs';
import net from 'net';
import { DAEMON_PORT_FILE, DAEMON_PID_FILE, DAEMON_HOST } from './lib/constants.js';
import { createDaemonServer } from './lib/daemon.js';

const command = process.argv[2] ?? 'status';

function isDaemonRunning(): { running: boolean; pid?: number } {
  if (!fs.existsSync(DAEMON_PID_FILE)) return { running: false };
  const pid = parseInt(fs.readFileSync(DAEMON_PID_FILE, 'utf8').trim());
  try {
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    fs.unlinkSync(DAEMON_PID_FILE);
    return { running: false };
  }
}

function getPort(): number | null {
  if (!fs.existsSync(DAEMON_PORT_FILE)) return null;
  const p = parseInt(fs.readFileSync(DAEMON_PORT_FILE, 'utf8').trim());
  return isNaN(p) ? null : p;
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
    if (status.pid) {
      try { process.kill(status.pid, 'SIGTERM'); } catch { /* already dead */ }
    }
    if (fs.existsSync(DAEMON_PID_FILE)) fs.unlinkSync(DAEMON_PID_FILE);
    if (fs.existsSync(DAEMON_PORT_FILE)) fs.unlinkSync(DAEMON_PORT_FILE);
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
      if (status.pid) {
        try { process.kill(status.pid, 'SIGTERM'); } catch { /* already dead */ }
      }
      if (fs.existsSync(DAEMON_PID_FILE)) fs.unlinkSync(DAEMON_PID_FILE);
      if (fs.existsSync(DAEMON_PORT_FILE)) fs.unlinkSync(DAEMON_PORT_FILE);
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
