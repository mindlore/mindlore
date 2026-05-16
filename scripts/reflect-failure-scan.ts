#!/usr/bin/env node
import path from 'path';
import { scanFailures } from './lib/telemetry-scan.js';
import { openDatabaseTs } from './lib/db-helpers.js';
import { DB_NAME, resolveMindloreHome, resolveProject, resolveTelemetryPath } from './lib/constants.js';

function main(): void {
  const home = resolveMindloreHome();
  const telemetryPath = resolveTelemetryPath();
  const dbPath = path.join(home, DB_NAME);
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
