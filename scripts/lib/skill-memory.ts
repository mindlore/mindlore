import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

interface SkillMemRow {
  skill_name: string;
  key: string;
  value: string;
  updated_at: string;
  access_count: number;
}

function openDb(dbPath: string, readonly = false): Database.Database {
  return new Database(dbPath, { readonly });
}

export function getSkillMem(dbPath: string, skill: string, key: string): string | null {
  const db = openDb(dbPath, true);
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare(
      'SELECT value FROM skill_memory WHERE skill_name = ? AND key = ?'
    ).get(skill, key) as { value: string } | undefined;
    return row?.value ?? null;
  } finally {
    db.close();
  }
}

export function setSkillMem(dbPath: string, skill: string, key: string, value: string): void {
  const db = openDb(dbPath);
  try {
    db.prepare(
      `INSERT INTO skill_memory (skill_name, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(skill_name, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    ).run(skill, key, value, new Date().toISOString());
  } finally {
    db.close();
  }
}

export function bumpAccess(dbPath: string, skill: string, key: string): void {
  const db = openDb(dbPath);
  try {
    db.prepare(
      `UPDATE skill_memory SET access_count = access_count + 1, updated_at = ?
       WHERE skill_name = ? AND key = ?`
    ).run(new Date().toISOString(), skill, key);
  } finally {
    db.close();
  }
}

export function listSkillMem(dbPath: string, skill: string): SkillMemRow[] {
  const db = openDb(dbPath, true);
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
    return db.prepare(
      'SELECT * FROM skill_memory WHERE skill_name = ? ORDER BY key'
    ).all(skill) as SkillMemRow[];
  } finally {
    db.close();
  }
}

// CLI entrypoint
const isMain = typeof require !== 'undefined' && require.main === module;
if (isMain) {
  const [action, skill, key, value] = process.argv.slice(2);
  const dbPath = path.join(
    process.env['MINDLORE_HOME'] ?? path.join(os.homedir(), '.mindlore'),
    'mindlore.db'
  );

  switch (action) {
    case 'get':
      if (!skill || !key) { console.error('Usage: skill-memory get <skill> <key>'); process.exit(1); }
      console.log(getSkillMem(dbPath, skill, key) ?? '');
      break;
    case 'set':
      if (!skill || !key || value === undefined) { console.error('Usage: skill-memory set <skill> <key> <value>'); process.exit(1); }
      setSkillMem(dbPath, skill, key, value);
      console.log('OK');
      break;
    case 'list':
      if (!skill) { console.error('Usage: skill-memory list <skill>'); process.exit(1); }
      console.log(JSON.stringify(listSkillMem(dbPath, skill)));
      break;
    case 'bump':
      if (!skill || !key) { console.error('Usage: skill-memory bump <skill> <key>'); process.exit(1); }
      bumpAccess(dbPath, skill, key);
      console.log('OK');
      break;
    default:
      console.error('Usage: skill-memory <get|set|list|bump> <skill> [key] [value]');
      process.exit(1);
  }
}
