import Database from 'better-sqlite3';
import { handleRelate } from '../scripts/lib/tool-adapters/relate-adapter';
import { V072_MIGRATIONS } from '../scripts/lib/migrations-v072';
import { V078_MIGRATIONS } from '../scripts/lib/migrations-v078';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`CREATE VIRTUAL TABLE mindlore_fts USING fts5(slug,path,title,content);`);
  V072_MIGRATIONS.forEach(m => m.up(db));
  V078_MIGRATIONS.forEach(m => m.up(db));
  db.prepare(`INSERT INTO mindlore_fts (slug,path,title,content) VALUES ('a','/a','A','x'),('b','/b','B','y')`).run();
  return db;
}

describe('relate-adapter symmetric semantics', () => {
  test('add(a,b,contradicts) → 2 row (forward + reverse)', () => {
    const db = setupDb();
    handleRelate({ db } as any, { action: 'add', source_a: 'a', source_b: 'b', relation_type: 'contradicts' });
    const rows = db.prepare(`SELECT source_a, source_b FROM mindlore_relations ORDER BY source_a`).all();
    expect(rows).toEqual([
      { source_a: 'a', source_b: 'b' },
      { source_a: 'b', source_b: 'a' },
    ]);
  });

  test('remove(a,b,contradicts) → 0 row', () => {
    const db = setupDb();
    handleRelate({ db } as any, { action: 'add', source_a: 'a', source_b: 'b', relation_type: 'contradicts' });
    handleRelate({ db } as any, { action: 'remove', source_a: 'a', source_b: 'b', relation_type: 'contradicts' });
    const count = db.prepare(`SELECT COUNT(*) as c FROM mindlore_relations`).get() as { c: number };
    expect(count.c).toBe(0);
  });

  test('remove(b,a,contradicts) → 0 row (reverse remove)', () => {
    const db = setupDb();
    handleRelate({ db } as any, { action: 'add', source_a: 'a', source_b: 'b', relation_type: 'contradicts' });
    const result: any = handleRelate({ db } as any, { action: 'remove', source_a: 'b', source_b: 'a', relation_type: 'contradicts' });
    expect(result.removed).toBe(true);
    const count = db.prepare(`SELECT COUNT(*) as c FROM mindlore_relations`).get() as { c: number };
    expect(count.c).toBe(0);
  });

  test('add(a,b,cites) → 1 row (non-symmetric single-direction)', () => {
    const db = setupDb();
    handleRelate({ db } as any, { action: 'add', source_a: 'a', source_b: 'b', relation_type: 'cites' });
    const count = db.prepare(`SELECT COUNT(*) as c FROM mindlore_relations`).get() as { c: number };
    expect(count.c).toBe(1);
  });
});
