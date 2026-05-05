import fs from 'fs';
import path from 'path';
import type { McpContext } from '../mcp-tools.js';

interface BriefInput {
  scope?: string;
}

interface BriefOutput {
  projectName: string;
  summary: string;
  recentDecisions: number;
  recentEpisodes: number;
  activeFrictions: number;
  topSources: string[];
}

const MAX_SUMMARY = 2000;

function countRecentFiles(dirPath: string, daysBack: number): number {
  if (!fs.existsSync(dirPath)) return 0;
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.md'))
    .filter(f => {
      try { return fs.statSync(path.join(dirPath, f)).mtimeMs >= cutoff; } catch { return false; }
    }).length;
}

function getTopSources(dirPath: string, limit: number): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => {
      try {
        return fs.statSync(path.join(dirPath, b)).mtimeMs - fs.statSync(path.join(dirPath, a)).mtimeMs;
      } catch { return 0; }
    })
    .slice(0, limit)
    .map(f => f.replace('.md', ''));
}

export function handleBrief(ctx: McpContext, input: BriefInput): BriefOutput {
  const isRecent = input.scope !== 'full';
  const daysBack = isRecent ? 7 : 365;
  const projectName = path.basename(ctx.baseDir) === '.mindlore'
    ? path.basename(path.dirname(ctx.baseDir))
    : path.basename(ctx.baseDir);

  const recentDecisions = countRecentFiles(path.join(ctx.baseDir, 'decisions'), daysBack);
  const recentEpisodes = countRecentFiles(path.join(ctx.baseDir, 'episodes'), daysBack);
  const topSources = getTopSources(path.join(ctx.baseDir, 'sources'), 5);

  const sourcesTotal = fs.existsSync(path.join(ctx.baseDir, 'sources'))
    ? fs.readdirSync(path.join(ctx.baseDir, 'sources')).filter(f => f.endsWith('.md')).length
    : 0;

  const summary = [
    `Knowledge base: ${sourcesTotal} sources, ${recentDecisions} recent decisions, ${recentEpisodes} recent episodes.`,
    topSources.length > 0 ? `Top sources: ${topSources.join(', ')}.` : '',
  ].filter(Boolean).join(' ').slice(0, MAX_SUMMARY);

  return {
    projectName,
    summary,
    recentDecisions,
    recentEpisodes,
    activeFrictions: 0,
    topSources,
  };
}
