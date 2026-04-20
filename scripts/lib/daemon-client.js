#!/usr/bin/env node
'use strict';

// Standalone daemon client — called via execFileSync from search hook.
// Plain JS (no build step) to avoid compilation dependency.
// Reads port from port file, connects to TCP daemon, sends embed request.

const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MINDLORE_DIR = '.mindlore';
const portFilePath = process.argv[2] || path.join(
  process.env.MINDLORE_HOME || path.join(os.homedir(), MINDLORE_DIR),
  'mindlore-daemon.port'
);
const query = process.argv[3] || '';
const timeout = parseInt(process.argv[4] || '300');

if (!query) {
  process.exit(1);
}

let port;
try {
  port = parseInt(fs.readFileSync(portFilePath, 'utf8').trim());
  if (isNaN(port)) process.exit(1);
} catch {
  process.exit(1);
}

const client = net.createConnection(port, '127.0.0.1');
const timer = setTimeout(() => { client.destroy(); process.exit(1); }, timeout);

client.on('connect', () => {
  client.write(JSON.stringify({ type: 'embed', text: 'query: ' + query }) + '\n');
});

client.on('data', (d) => {
  clearTimeout(timer);
  fs.writeSync(1, d.toString());
  client.destroy();
  process.exit(0);
});

client.on('error', () => {
  clearTimeout(timer);
  process.exit(1);
});
