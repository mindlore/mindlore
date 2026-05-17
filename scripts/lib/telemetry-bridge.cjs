const fs = require('fs');
const path = require('path');

const ROTATE_AT_BYTES = 10 * 1024 * 1024;

function getMindloreHome() {
  return process.env.MINDLORE_HOME || require('os').homedir();
}

function getTelemetryFile() {
  if (process.env.MINDLORE_TELEMETRY_PATH) return process.env.MINDLORE_TELEMETRY_PATH;
  return path.join(getMindloreHome(), '.mindlore', 'telemetry.jsonl');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function rotateIfNeeded(file) {
  try {
    const stat = fs.statSync(file);
    if (stat.size >= ROTATE_AT_BYTES) {
      const archive = file + '.1';
      if (fs.existsSync(archive)) fs.unlinkSync(archive);
      fs.renameSync(file, archive);
    }
  } catch (_e) {
    // file missing, no rotation needed
  }
}

function writeTelemetry(entry) {
  const file = getTelemetryFile();
  ensureDir(path.dirname(file));
  rotateIfNeeded(file);
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
}

module.exports = { writeTelemetry };
