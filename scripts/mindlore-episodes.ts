#!/usr/bin/env node

/**
 * mindlore episodes — CLI for querying episodic memory.
 *
 * Usage:
 *   npx mindlore episodes list [--kind <kind>] [--project <name>] [--limit <n>]
 *   npx mindlore episodes search <query>
 *   npx mindlore episodes show <id>
 *   npx mindlore episodes count [--project <name>]
 */

import path from 'path';
import { GLOBAL_MINDLORE_DIR, DB_NAME, getProjectName } from './lib/constants.js';
import { getEpisode, queryEpisodes, countEpisodes, EPISODE_KINDS } from './lib/episodes.js';
import type { QueryEpisodesOptions } from './lib/episodes.js';
import { dbAll } from './lib/db-helpers.js';

function openDb(): import('better-sqlite3').Database | null {
  try {
    const Database: typeof import('better-sqlite3') = require('better-sqlite3');
    const dbPath = path.join(GLOBAL_MINDLORE_DIR, DB_NAME);
    return new Database(dbPath, { readonly: true });
  } catch (_err) {
    console.error('Error: Could not open mindlore database.');
    return null;
  }
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (arg.startsWith('--') && i + 1 < args.length) {
      result[arg.slice(2)] = args[i + 1] ?? '';
      i++;
    } else if (!arg.startsWith('--')) {
      result[`_${Object.keys(result).filter(k => k.startsWith('_')).length}`] = arg;
    }
  }
  return result;
}

function cmdList(args: string[]): void {
  const db = openDb();
  if (!db) return;

  const parsed = parseArgs(args);
  const opts: QueryEpisodesOptions = {};

  if (parsed['kind']) {
    const kindInput = parsed['kind'];
    const validKind = EPISODE_KINDS.find(k => k === kindInput);
    if (!validKind) {
      console.error(`Invalid kind: ${kindInput}. Valid: ${EPISODE_KINDS.join(', ')}`);
      db.close();
      return;
    }
    opts.kind = validKind;
  }
  if (parsed['project']) opts.project = parsed['project'];
  if (parsed['limit']) opts.limit = parseInt(parsed['limit'], 10) || 50;
  if (parsed['since']) opts.since = parsed['since'];

  const episodes = queryEpisodes(db, opts);
  db.close();

  if (episodes.length === 0) {
    console.log('No episodes found.');
    return;
  }

  console.log(`\n  Episodes (${episodes.length}):\n`);
  for (const ep of episodes) {
    const date = ep.created_at.slice(0, 10);
    const project = ep.project ? ` [${ep.project}]` : '';
    console.log(`  ${date}  ${ep.kind.padEnd(12)} ${ep.summary.slice(0, 80)}${project}`);
    console.log(`           id: ${ep.id}  source: ${ep.source}`);
  }
  console.log('');
}

function cmdSearch(args: string[]): void {
  const query = args.join(' ').trim();
  if (!query) {
    console.error('Usage: npx mindlore episodes search <query>');
    return;
  }

  const db = openDb();
  if (!db) return;

  // Search in summary + body using LIKE (episodes is regular table, not FTS5)
  const pattern = `%${query}%`;
  type EpisodeSearchRow = Pick<import('./lib/episodes.js').Episode, 'id' | 'kind' | 'summary' | 'project' | 'created_at' | 'source'>;
  const results = dbAll<EpisodeSearchRow>(
    db,
    "SELECT id, kind, summary, project, created_at, source FROM episodes WHERE status = 'active' AND (summary LIKE ? OR body LIKE ?) ORDER BY created_at DESC LIMIT 20",
    pattern, pattern,
  );
  db.close();

  if (results.length === 0) {
    console.log(`No episodes matching "${query}".`);
    return;
  }

  console.log(`\n  Search: "${query}" (${results.length} results)\n`);
  for (const ep of results) {
    const date = ep.created_at.slice(0, 10);
    const project = ep.project ? ` [${ep.project}]` : '';
    console.log(`  ${date}  ${ep.kind.padEnd(12)} ${ep.summary.slice(0, 80)}${project}`);
    console.log(`           id: ${ep.id}`);
  }
  console.log('');
}

function cmdShow(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.error('Usage: npx mindlore episodes show <id>');
    return;
  }

  const db = openDb();
  if (!db) return;

  const ep = getEpisode(db, id);
  db.close();

  if (!ep) {
    console.error(`Episode not found: ${id}`);
    return;
  }

  console.log(`\n  Episode: ${ep.id}`);
  console.log(`  Kind:    ${ep.kind}`);
  console.log(`  Status:  ${ep.status}`);
  console.log(`  Scope:   ${ep.scope}`);
  console.log(`  Project: ${ep.project ?? '(global)'}`);
  console.log(`  Source:  ${ep.source}`);
  console.log(`  Created: ${ep.created_at}`);
  if (ep.tags) console.log(`  Tags:    ${ep.tags}`);
  if (ep.parent_id) console.log(`  Parent:  ${ep.parent_id}`);
  if (ep.supersedes) console.log(`  Supersedes: ${ep.supersedes}`);
  if (ep.entities) {
    try {
      const parsed: unknown = JSON.parse(ep.entities);
      const entities = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      console.log(`  Entities: ${entities.join(', ')}`);
    } catch (_err) {
      console.log(`  Entities: ${ep.entities}`);
    }
  }
  console.log(`\n  Summary: ${ep.summary}`);
  if (ep.body) {
    console.log(`\n${ep.body}`);
  }
  console.log('');
}

function cmdCount(args: string[]): void {
  const db = openDb();
  if (!db) return;

  const parsed = parseArgs(args);
  const project = parsed['project'] ?? getProjectName();
  const total = countEpisodes(db);
  const projectCount = countEpisodes(db, project);
  db.close();

  console.log(`\n  Episodes: ${total} total, ${projectCount} in ${project}\n`);
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'list':
      cmdList(args.slice(1));
      break;
    case 'search':
      cmdSearch(args.slice(1));
      break;
    case 'show':
      cmdShow(args.slice(1));
      break;
    case 'count':
      cmdCount(args.slice(1));
      break;
    default:
      console.log('Usage: npx mindlore episodes <command>');
      console.log('');
      console.log('Commands:');
      console.log('  list   [--kind <kind>] [--project <name>] [--limit <n>]');
      console.log('  search <query>');
      console.log('  show   <id>');
      console.log('  count  [--project <name>]');
      console.log('');
      console.log(`Kinds: ${EPISODE_KINDS.join(', ')}`);
      break;
  }
}

main();
