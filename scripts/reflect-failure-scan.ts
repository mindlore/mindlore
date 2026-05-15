#!/usr/bin/env node
import path from 'path';
import os from 'os';
import { scanFailures } from './lib/telemetry-scan.js';
import { openDatabaseTs } from './lib/db-helpers.js';

function mindloreHome(): string {
  return process.env.MINDLORE_HOME ?? path.join(os.homedir(), '.mindlore');
}

function resolveProject(): string {
  if (process.env.MINDLORE_PROJECT) return process.env.MINDLORE_PROJECT;
  const cwd = process.cwd();
  const base = cwd.split(/[\\/]/).pop() || 'global';
  return base.toLowerCase();
}

function main(): void {
  const home = mindloreHome();
  const telemetryPath = path.join(home, 'telemetry.jsonl');
  const dbPath = path.join(home, 'mindlore.db');
  const failures = scanFailures(telemetryPath);
  if (failures.length === 0) {
    console.log('No skill failures detected.');
    return;
  }
  const db = openDatabaseTs(dbPath);
  if (!db) {
    console.error('DB unavailable, skipping skill_failure emission.');
    return;
  }
  const project = resolveProject();
  const insert = db.prepare(`
    INSERT INTO episodes(kind, status, project, summary, body, source, created_at)
    VALUES ('skill_failure', 'active', ?, ?, ?, 'reflect-failure-scan', ?)
  `);
  let inserted = 0;
  for (const f of failures) {
    const summary = `${f.skill}/${f.script} failed: ${(f.output.split('\n')[0] ?? '').slice(0, 200)}`;
    const body = JSON.stringify(f);
    insert.run(project, summary, body, f.ts);
    inserted++;
  }
  db.close();
  console.log(`Inserted ${inserted} skill_failure episodes.`);
}

main();
