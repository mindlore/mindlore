/**
 * session-payload — builds 4 structured injection sections for SessionStart.
 * Token budget enforcement + content-hash cache-lock.
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
  skipInjection: boolean;
}

interface EpisodeRow {
  summary: string;
  created_at: string;
}

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

let lastHash: string | null = null;

export function resetCache(): void {
  lastHash = null;
}

function buildSessionSummary(baseDir: string): string {
  const diaryDir = path.join(baseDir, 'diary');
  if (!fs.existsSync(diaryDir)) return 'No previous session data.';
  const deltas = fs.readdirSync(diaryDir).filter(f => f.startsWith('delta-')).sort();
  if (deltas.length === 0) return 'No previous session data.';
  const latestFile = deltas[deltas.length - 1] ?? '';
  const latest = fs.readFileSync(path.join(diaryDir, latestFile), 'utf8');
  const lines = latest.split('\n').filter(l => l.startsWith('- ') || l.startsWith('# '));
  return lines.slice(0, 10).join('\n');
}

function buildDecisions(db: Database.Database, project: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
  const decisions = db.prepare(
    `SELECT summary, created_at FROM episodes
     WHERE kind = 'decision' AND status = 'active' AND project = ?
     ORDER BY created_at DESC LIMIT 5`,
  ).all(project) as EpisodeRow[];
  if (decisions.length === 0) return 'No recent decisions.';
  return decisions.map(d => `- ${d.summary} (${d.created_at.slice(0, 10)})`).join('\n');
}

function buildFriction(db: Database.Database, project: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
  const frictions = db.prepare(
    `SELECT summary, created_at FROM episodes
     WHERE kind = 'friction' AND status = 'active' AND project = ?
     ORDER BY created_at DESC LIMIT 3`,
  ).all(project) as EpisodeRow[];
  if (frictions.length === 0) return 'No active friction points.';
  return frictions.map(f => `- ${f.summary} (${f.created_at.slice(0, 10)})`).join('\n');
}

function buildLearnings(db: Database.Database, project: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
  const learnings = db.prepare(
    `SELECT summary, created_at FROM episodes
     WHERE kind = 'learning' AND status = 'active' AND project = ?
     ORDER BY created_at DESC LIMIT 5`,
  ).all(project) as EpisodeRow[];
  if (learnings.length === 0) return 'No recent learnings.';
  return learnings.map(l => `- ${l.summary} (${l.created_at.slice(0, 10)})`).join('\n');
}

export function buildSessionPayload(
  db: Database.Database,
  baseDir: string,
  project: string,
  tokenBudget: number = 2000,
): SessionPayload {
  const sections: SessionSection[] = [];

  const summary = buildSessionSummary(baseDir);
  sections.push({ label: 'Session', content: summary, tokens: estimateTokens(summary) });

  const decisions = buildDecisions(db, project);
  sections.push({ label: 'Decisions', content: decisions, tokens: estimateTokens(decisions) });

  const friction = buildFriction(db, project);
  sections.push({ label: 'Friction', content: friction, tokens: estimateTokens(friction) });

  const learnings = buildLearnings(db, project);
  sections.push({ label: 'Learnings', content: learnings, tokens: estimateTokens(learnings) });

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
      sections.push({ label: 'Session', content: `# Son Sessionlar\n${content}`, tokens: estimateTokens(content) });
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
  const skipInjection = contentHash === lastHash;
  lastHash = contentHash;

  return { sections, totalTokens, contentHash, skipInjection };
}
