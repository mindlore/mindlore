'use strict';

const fs = require('fs');

function safeMkdir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}

function safeWriteFile(filePath, data) {
  fs.writeFileSync(filePath, data, { encoding: 'utf8', mode: 0o600 });
}

function safeWriteJson(filePath, obj) {
  safeWriteFile(filePath, JSON.stringify(obj, null, 2) + '\n');
}

module.exports = { safeMkdir, safeWriteFile, safeWriteJson };
