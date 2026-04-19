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
  const latestFile = deltas[deltas.length - 1]!;
  const latest = fs.readFileSync(path.join(diaryDir, latestFile), 'utf8');
  const lines = latest.split('\n').filter(l => l.startsWith('- ') || l.startsWith('# '));
  return lines.slice(0, 10).join('\n');
}

function buildDecisions(db: Database.Database, project: string): string {
  const decisions = db.prepare(
    `SELECT summary, created_at FROM episodes
     WHERE kind = 'decision' AND status = 'active' AND project = ?
     ORDER BY created_at DESC LIMIT 5`,
  ).all(project) as Array<{ summary: string; created_at: string }>;
  if (decisions.length === 0) return 'No recent decisions.';
  return decisions.map(d => `- ${d.summary} (${d.created_at.slice(0, 10)})`).join('\n');
}

function buildFriction(db: Database.Database, project: string): string {
  const frictions = db.prepare(
    `SELECT summary, created_at FROM episodes
     WHERE kind = 'friction' AND status = 'active' AND project = ?
     ORDER BY created_at DESC LIMIT 3`,
  ).all(project) as Array<{ summary: string; created_at: string }>;
  if (frictions.length === 0) return 'No active friction points.';
  return frictions.map(f => `- ${f.summary} (${f.created_at.slice(0, 10)})`).join('\n');
}

function buildLearnings(db: Database.Database, project: string): string {
  const learnings = db.prepare(
    `SELECT summary, created_at FROM episodes
     WHERE kind = 'learning' AND status = 'active' AND project = ?
     ORDER BY created_at DESC LIMIT 5`,
  ).all(project) as Array<{ summary: string; created_at: string }>;
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

  let totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
  while (totalTokens > tokenBudget && sections.length > 1) {
    const removed = sections.pop()!;
    totalTokens -= removed.tokens;
  }

  const allContent = sections.map(s => s.content).join('|');
  const contentHash = crypto.createHash('md5').update(allContent).digest('hex').slice(0, 8);
  const skipInjection = contentHash === lastHash;
  lastHash = contentHash;

  return { sections, totalTokens, contentHash, skipInjection };
}
