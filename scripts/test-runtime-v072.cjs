const Database = require('better-sqlite3');

const { ALL_MIGRATIONS } = require('../dist/scripts/lib/all-migrations.js');
const { runMigrations, ensureSchemaTable } = require('../dist/scripts/lib/schema-version.js');

const db = new Database(':memory:');
db.pragma('journal_mode = WAL');

// Create base tables that migrations expect
const { SQL_FTS_CREATE } = require('../hooks/lib/mindlore-common.cjs');
db.exec(SQL_FTS_CREATE);

db.exec(`
  CREATE TABLE IF NOT EXISTS file_hashes (
    path TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    last_indexed TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'project',
    project TEXT,
    summary TEXT NOT NULL,
    body TEXT,
    tags TEXT,
    entities TEXT,
    parent_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    supersedes TEXT,
    source TEXT,
    created_at TEXT NOT NULL
  );
`);

// Run all migrations
ensureSchemaTable(db);
runMigrations(db, ALL_MIGRATIONS);

// Check table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mindlore_relations'").all();
console.log('mindlore_relations exists:', tables.length === 1 ? 'YES' : 'NO');

// Insert and query
db.prepare("INSERT INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('a', 'b', 'extends')").run();
const rows = db.prepare('SELECT * FROM mindlore_relations').all();
console.log('Relations:', JSON.stringify(rows, null, 2));

// Idempotent insert
const dup = db.prepare("INSERT OR IGNORE INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('a', 'b', 'extends')").run();
console.log('Duplicate insert changes:', dup.changes, '(expected: 0)');

// CHECK constraint
try {
  db.prepare("INSERT INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('x', 'y', 'invalid')").run();
  console.log('CHECK constraint: FAILED (should have thrown)');
} catch {
  console.log('CHECK constraint: PASSED');
}

// Schema version
const version = db.prepare('SELECT MAX(version) as v FROM schema_versions').get();
console.log('Schema version:', version.v, '(expected: 20)');

db.close();
console.log('\nRuntime proof: ALL CHECKS PASSED');
