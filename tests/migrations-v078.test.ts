import Database from 'better-sqlite3';
import { V072_MIGRATIONS } from '../scripts/lib/migrations-v072';
import { V078_MIGRATIONS } from '../scripts/lib/migrations-v078';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`CREATE VIRTUAL TABLE mindlore_fts USING fts5(slug, path, title, content);`);
  V072_MIGRATIONS.forEach(m => m.up(db));
  return db;
}

describe('V078 migration — symmetric reverse backfill', () => {
  test('contradicts single-direction row → two-direction row', () => {
    const db = setupDb();
    db.prepare(`INSERT INTO mindlore_fts (slug, path, title, content) VALUES ('a','/a','A','x'),('b','/b','B','y')`).run();
    db.prepare(`INSERT INTO mindlore_relations (source_a, source_b, relation_type) VALUES ('a','b','contradicts')`).run();
    expect(db.prepare(`SELECT COUNT(*) as c FROM mindlore_relations`).get()).toEqual({ c: 1 });
    V078_MIGRATIONS.forEach(m => m.up(db));
    expect(db.prepare(`SELECT COUNT(*) as c FROM mindlore_relations`).get()).toEqual({ c: 2 });
    const rows = db.prepare(`SELECT source_a, source_b FROM mindlore_relations ORDER BY source_a`).all();
    expect(rows).toEqual([
      { source_a: 'a', source_b: 'b' },
      { source_a: 'b', source_b: 'a' },
    ]);
  });

  test('cites/extends/supersedes unaffected', () => {
    const db = setupDb();
    db.prepare(`INSERT INTO mindlore_fts (slug,path,title,content) VALUES ('a','/a','A','x'),('b','/b','B','y')`).run();
    db.prepare(`INSERT INTO mindlore_relations (source_a,source_b,relation_type) VALUES ('a','b','cites'),('a','b','extends'),('a','b','supersedes')`).run();
    V078_MIGRATIONS.forEach(m => m.up(db));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const count = db.prepare(`SELECT COUNT(*) as c FROM mindlore_relations`).get() as { c: number };
    expect(count.c).toBe(3);
  });

  test('idempotent (2x run → same result)', () => {
    const db = setupDb();
    db.prepare(`INSERT INTO mindlore_fts (slug,path,title,content) VALUES ('a','/a','A','x'),('b','/b','B','y')`).run();
    db.prepare(`INSERT INTO mindlore_relations (source_a,source_b,relation_type) VALUES ('a','b','contradicts')`).run();
    V078_MIGRATIONS.forEach(m => m.up(db));
    V078_MIGRATIONS.forEach(m => m.up(db));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const count = db.prepare(`SELECT COUNT(*) as c FROM mindlore_relations`).get() as { c: number };
    expect(count.c).toBe(2);
  });

  test('already two-direction does not duplicate', () => {
    const db = setupDb();
    db.prepare(`INSERT INTO mindlore_fts (slug,path,title,content) VALUES ('a','/a','A','x'),('b','/b','B','y')`).run();
    db.prepare(`INSERT INTO mindlore_relations (source_a,source_b,relation_type) VALUES ('a','b','contradicts'),('b','a','contradicts')`).run();
    V078_MIGRATIONS.forEach(m => m.up(db));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const count = db.prepare(`SELECT COUNT(*) as c FROM mindlore_relations`).get() as { c: number };
    expect(count.c).toBe(2);
  });
});
