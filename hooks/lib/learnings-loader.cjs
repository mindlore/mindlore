const fs = require('fs');
const path = require('path');
const { parseFrontmatter, hookLog } = require('./mindlore-common.cjs');

const MAX_LESSONS = 10;
const MAX_LINES_PER_LESSON = 5;
const TOTAL_CHAR_BUDGET = 6000;

function summarizeLesson(body, relPath) {
  const lines = body.split('\n');
  const h2Idx = lines.findIndex(l => l.startsWith('## '));
  const start = h2Idx >= 0 ? h2Idx : 0;
  const slice = lines.slice(start, start + MAX_LINES_PER_LESSON).join('\n');
  const rest = lines.slice(start + MAX_LINES_PER_LESSON).length > 0
    ? `\n… (full: ${relPath})`
    : '';
  return slice + rest;
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
    if (candidates.length >= MAX_LESSONS) break;
    let raw;
    try { raw = fs.readFileSync(s.abs, 'utf8'); } catch (err) {
      hookLog('learnings-loader', 'warn', `read skipped ${s.file}: ${err.message}`);
      continue;
    }
    const { meta, body } = parseFrontmatter(raw);
    const project = meta.project || 'global';
    if (project !== 'global' && project !== currentProject) continue;
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
    if (used + piece.length > TOTAL_CHAR_BUDGET && count > 0) break;
    block += piece;
    used += piece.length;
    count++;
  }
  return block.trimEnd();
}

module.exports = { loadLearningsBlock };
