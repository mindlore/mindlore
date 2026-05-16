const fs = require('fs');
const path = require('path');
const { parseFrontmatter, hookLog } = require('./mindlore-common.cjs');
const { LEARNINGS_MAX_LESSONS, LEARNINGS_MAX_LINES_PER_LESSON, LEARNINGS_TOTAL_CHAR_BUDGET } = require('../../dist/scripts/lib/constants.js');

function summarizeLesson(body, relPath) {
  const lines = body.split('\n');
  const h2Idx = lines.findIndex(l => l.startsWith('## '));
  const start = h2Idx >= 0 ? h2Idx : 0;
  const slice = lines.slice(start, start + LEARNINGS_MAX_LINES_PER_LESSON).join('\n');
  const rest = lines.slice(start + LEARNINGS_MAX_LINES_PER_LESSON).length > 0
    ? `\n… (full: ${relPath})`
    : '';
  return slice + rest;
}

function readProjectField(filePath) {
  const buf = Buffer.alloc(512);
  const fd = fs.openSync(filePath, 'r');
  try {
    const n = fs.readSync(fd, buf, 0, 512, 0);
    const head = buf.subarray(0, n).toString('utf8');
    const m = head.match(/^project:\s*(.+)$/m);
    return m ? m[1].trim() : undefined;
  } finally {
    fs.closeSync(fd);
  }
}

function loadLearningsBlock(mindloreDir, currentProject) {
  const learningsDir = path.join(mindloreDir, 'learnings');
  if (!fs.existsSync(learningsDir)) return '';
  const files = fs.readdirSync(learningsDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) return '';

  const stats = [];
  for (const f of files) {
    const abs = path.join(learningsDir, f);
    try {
      const stat = fs.statSync(abs);
      stats.push({ file: f, abs, mtime: stat.mtimeMs });
    } catch (err) {
      hookLog('learnings-loader', 'warn', `stat skipped ${f}: ${err.message}`);
    }
  }
  stats.sort((a, b) => b.mtime - a.mtime);

  const candidates = [];
  for (const s of stats) {
    if (candidates.length >= LEARNINGS_MAX_LESSONS) break;
    const project = readProjectField(s.abs) || 'global';
    if (project !== 'global' && project !== currentProject) continue;
    let raw;
    try { raw = fs.readFileSync(s.abs, 'utf8'); } catch (err) {
      hookLog('learnings-loader', 'warn', `read skipped ${s.file}: ${err.message}`);
      continue;
    }
    const { body } = parseFrontmatter(raw);
    candidates.push({
      relPath: `.mindlore/learnings/${s.file}`,
      body,
    });
  }

  if (candidates.length === 0) return '';

  let block = '[Mindlore Learnings]\n';
  let used = block.length;
  let count = 0;
  for (const c of candidates) {
    const piece = summarizeLesson(c.body, c.relPath) + '\n\n';
    if (used + piece.length > LEARNINGS_TOTAL_CHAR_BUDGET && count > 0) break;
    block += piece;
    used += piece.length;
    count++;
  }
  return block.trimEnd();
}

module.exports = { loadLearningsBlock };
