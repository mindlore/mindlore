import Database from 'better-sqlite3';
import { getRelationsForSlugs } from '../scripts/lib/relation-helpers';
import { V072_MIGRATIONS } from '../scripts/lib/migrations-v072';
import { V078_MIGRATIONS } from '../scripts/lib/migrations-v078';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`CREATE VIRTUAL TABLE mindlore_fts USING fts5(slug,path,title,content);`);
  V072_MIGRATIONS.forEach(m => m.up(db));
  V078_MIGRATIONS.forEach(m => m.up(db));
  for (const s of ['a','b','c','d','e']) {
    db.prepare(`INSERT INTO mindlore_fts (slug,path,title,content) VALUES (?, ?, ?, ?)`).run(s, '/'+s, s.toUpperCase(), 'x');
  }
  return db;
}

describe('getRelationsForSlugs — batch query', () => {
  test('5 slug → single SQL execution, slug-grouped results', () => {
    const db = setupDb();
    db.prepare(`INSERT INTO mindlore_relations (source_a,source_b,relation_type) VALUES ('a','b','cites'),('a','c','extends'),('c','d','cites'),('e','a','supersedes')`).run();

    const original = db.prepare.bind(db);
    let prepareCalls = 0;
    (db as { prepare: typeof original }).prepare = (sql: string) => { prepareCalls++; return original(sql); };

    const result = getRelationsForSlugs(db, ['a','b','c','d','e']);

    expect(prepareCalls).toBeLessThanOrEqual(1);
    expect(result.get('a')).toEqual(expect.arrayContaining([
      { source: 'b', relation_type: 'cites', direction: 'outgoing' },
      { source: 'c', relation_type: 'extends', direction: 'outgoing' },
    ]));
    expect(result.get('c')).toEqual([
      { source: 'd', relation_type: 'cites', direction: 'outgoing' },
    ]);
    expect(result.get('e')).toEqual([
      { source: 'a', relation_type: 'supersedes', direction: 'outgoing' },
    ]);
    expect(result.get('b')).toEqual([]);
  });

  test('empty slug list → empty map', () => {
    const db = setupDb();
    const result = getRelationsForSlugs(db, []);
    expect(result.size).toBe(0);
  });

  test('1 slug → same result as getRelationsForSlug', () => {
    const db = setupDb();
    db.prepare(`INSERT INTO mindlore_relations (source_a,source_b,relation_type) VALUES ('a','b','cites')`).run();
    const result = getRelationsForSlugs(db, ['a']);
    expect(result.get('a')).toEqual([
      { source: 'b', relation_type: 'cites', direction: 'outgoing' },
    ]);
  });
});
