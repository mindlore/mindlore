import Database from 'better-sqlite3';
import { V072_MIGRATIONS } from '../../scripts/lib/migrations-v072';
import { V078_MIGRATIONS } from '../../scripts/lib/migrations-v078';

export interface SeedFixture {
  db: Database.Database;
  slugs: string[];
}

export function buildRrfFixture(): SeedFixture {
  const db = new Database(':memory:');
  db.exec(`
    CREATE VIRTUAL TABLE mindlore_fts USING fts5(slug, path, title, content);
    CREATE TABLE file_hashes (
      path TEXT PRIMARY KEY,
      recall_count INTEGER DEFAULT 0,
      last_recalled_at TEXT,
      last_indexed TEXT
    );
  `);
  V072_MIGRATIONS.forEach(m => m.up(db));
  V078_MIGRATIONS.forEach(m => m.up(db));

  const slugs = ['s1','s2','s3','s4','s5'];
  const recalls = [0, 1, 5, 10, 30];
  for (let i = 0; i < slugs.length; i++) {
    const s = slugs[i]!;
    db.prepare(`INSERT INTO mindlore_fts (slug,path,title,content) VALUES (?, ?, ?, ?)`).run(s, '/'+s, s.toUpperCase(), 'lorem');
    db.prepare(`INSERT INTO file_hashes (path, recall_count, last_recalled_at, last_indexed) VALUES (?, ?, ?, ?)`).run('/'+s, recalls[i], '2026-05-17T00:00:00Z', '2026-05-17T00:00:00Z');
  }

  // Relations: s1↔s2 contradicts (symmetric, 2 rows), s3→s4 cites, s3→s5 cites
  db.prepare(`INSERT INTO mindlore_relations (source_a,source_b,relation_type) VALUES ('s1','s2','contradicts'),('s2','s1','contradicts'),('s3','s4','cites'),('s3','s5','cites')`).run();

  return { db, slugs };
}
