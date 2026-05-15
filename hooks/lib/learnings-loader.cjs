const fs = require('fs');
const path = require('path');

const MAX_LESSONS = 10;
const MAX_LINES_PER_LESSON = 5;
const TOTAL_CHAR_BUDGET = 6000;

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return { frontmatter: {}, body: content };
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return { frontmatter: {}, body: content };
  const fmRaw = content.slice(4, end);
  const body = content.slice(end + 5);
  const frontmatter = {};
  for (const line of fmRaw.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.+)$/);
    if (m) frontmatter[m[1]] = m[2].trim();
  }
  return { frontmatter, body };
}

function summarizeLesson(filePath, body, slug, relPath) {
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

  const candidates = [];
  for (const f of files) {
    const abs = path.join(learningsDir, f);
    let raw;
    try { raw = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const { frontmatter, body } = parseFrontmatter(raw);
    const project = frontmatter.project || 'global';
    if (project !== 'global' && project !== currentProject) continue;
    const stat = fs.statSync(abs);
    candidates.push({
      file: f,
      relPath: `.mindlore/learnings/${f}`,
      mtime: stat.mtimeMs,
      body,
    });
  }

  if (candidates.length === 0) return '';

  candidates.sort((a, b) => b.mtime - a.mtime);

  let block = '[Mindlore Learnings]\n';
  let used = block.length;
  let count = 0;
  for (const c of candidates) {
    if (count >= MAX_LESSONS) break;
    const piece = summarizeLesson(c.file, c.body, c.file, c.relPath) + '\n\n';
    if (used + piece.length > TOTAL_CHAR_BUDGET && count > 0) break;
    block += piece;
    used += piece.length;
    count++;
  }
  return block.trimEnd();
}

module.exports = { loadLearningsBlock };
