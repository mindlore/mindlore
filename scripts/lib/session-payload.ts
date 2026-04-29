/**
 * session-payload — builds 4 structured injection sections for SessionStart.
 * Token budget enforcement + content-hash.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SessionSection {
  label: string;
  content: string;
  tokens: number;
}

export interface SessionPayload {
  sections: SessionSection[];
  totalTokens: number;
  contentHash: string;
}

interface EpisodeRow {
  kind: string;
  summary: string;
  created_at: string;
}

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function buildSessionSummary(baseDir: string, latestDeltaContent?: string): string {
  if (latestDeltaContent) {
    const lines = latestDeltaContent.split('\n').filter(l => l.startsWith('- ') || l.startsWith('# '));
    return lines.slice(0, 10).join('\n') || 'No previous session data.';
  }
  const diaryDir = path.join(baseDir, 'diary');
  if (!fs.existsSync(diaryDir)) return 'No previous session data.';
  const deltas = fs.readdirSync(diaryDir).filter(f => f.startsWith('delta-')).sort();
  if (deltas.length === 0) return 'No previous session data.';
  const latestFile = deltas[deltas.length - 1] ?? '';
  const latest = fs.readFileSync(path.join(diaryDir, latestFile), 'utf8');
  const lines = latest.split('\n').filter(l => l.startsWith('- ') || l.startsWith('# '));
  return lines.slice(0, 10).join('\n');
}

function buildEpisodeSections(db: Database.Database, project: string): { decisions: string; friction: string; learnings: string } {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
  const rows = db.prepare(
    `SELECT kind, summary, created_at FROM episodes
     WHERE status = 'active' AND project = ?
       AND kind IN ('decision', 'friction', 'learning')
     ORDER BY kind, created_at DESC`,
  ).all(project) as EpisodeRow[];

  const grouped = { decision: [] as EpisodeRow[], friction: [] as EpisodeRow[], learning: [] as EpisodeRow[] };
  for (const row of rows) {
    if (row.kind in grouped) {
      grouped[row.kind as keyof typeof grouped].push(row);
    }
  }

  const fmt = (items: EpisodeRow[], limit: number) =>
    items.slice(0, limit).map(r => `- ${r.summary} (${r.created_at.slice(0, 10)})`).join('\n');

  return {
    decisions: grouped.decision.length > 0 ? fmt(grouped.decision, 5) : 'No recent decisions.',
    friction: grouped.friction.length > 0 ? fmt(grouped.friction, 3) : 'No active friction points.',
    learnings: grouped.learning.length > 0 ? fmt(grouped.learning, 5) : 'No recent learnings.',
  };
}

export function buildSessionPayload(
  db: Database.Database,
  baseDir: string,
  project: string,
  tokenBudget: number = 2000,
  latestDeltaContent?: string,
): SessionPayload {
  const sections: SessionSection[] = [];

  const summary = buildSessionSummary(baseDir, latestDeltaContent);
  sections.push({ label: 'Session', content: summary, tokens: estimateTokens(summary) });

  const episodes = buildEpisodeSections(db, project);
  sections.push({ label: 'Decisions', content: episodes.decisions, tokens: estimateTokens(episodes.decisions) });
  sections.push({ label: 'Friction', content: episodes.friction, tokens: estimateTokens(episodes.friction) });
  sections.push({ label: 'Learnings', content: episodes.learnings, tokens: estimateTokens(episodes.learnings) });

  // Session summaries from recent sessions (#9)
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
    const summaries = db.prepare(
      `SELECT session_summary, created_at FROM episodes
       WHERE kind = 'session-summary' AND project = ? AND session_summary IS NOT NULL
       ORDER BY created_at DESC LIMIT 3`,
    ).all(project) as Array<{ session_summary: string; created_at: string }>;

    if (summaries.length > 0) {
      const content = summaries.map(s =>
        `- ${s.created_at.slice(0, 16)}: ${s.session_summary}`
      ).join('\n');
      sections.push({ label: 'Past Sessions', content: `# Son Sessionlar\n${content}`, tokens: estimateTokens(content) });
    }
  } catch { /* session_summary column may not exist */ }

  let totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
  while (totalTokens > tokenBudget && sections.length > 1) {
    const removed = sections.pop();
    if (!removed) break;
    totalTokens -= removed.tokens;
  }

  const allContent = sections.map(s => s.content).join('|');
  const contentHash = crypto.createHash('md5').update(allContent).digest('hex').slice(0, 8);

  return { sections, totalTokens, contentHash };
}
