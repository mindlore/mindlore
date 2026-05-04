import fs from 'fs';
import os from 'os';
import path from 'path';
import { levenshtein, findClosestWords, correctQuery, populateVocabulary, loadVocabulary } from '../scripts/lib/fuzzy.js';
import { createTestDbWithFullSchema } from './helpers/db.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

test('levenshtein distance', () => {
  expect(levenshtein('kitten', 'sitting')).toBe(3);
  expect(levenshtein('', 'abc')).toBe(3);
  expect(levenshtein('same', 'same')).toBe(0);
});

test('findClosestWords returns corrections', () => {
  const vocabulary = ['kubernetes', 'typescript', 'javascript', 'react'];
  const corrections = findClosestWords('kuberntes', vocabulary);
  expect(corrections[0]).toBe('kubernetes');
});

test('max distance threshold', () => {
  const vocabulary = ['kubernetes'];
  const corrections = findClosestWords('xyz', vocabulary);
  expect(corrections).toEqual([]);
});

test('exact match not returned as correction', () => {
  const vocabulary = ['typescript'];
  const corrections = findClosestWords('typescript', vocabulary);
  expect(corrections).toEqual([]);
});

describe('DB integration', () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-fuzzy-'));
    db = createTestDbWithFullSchema(path.join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('populateVocabulary + loadVocabulary round-trip', () => {
    populateVocabulary(db, 'TypeScript hooks are powerful tools for building');
    const vocab = loadVocabulary(db);
    expect(vocab).toContain('typescript');
    expect(vocab).toContain('hooks');
    expect(vocab).toContain('powerful');
  });

  test('populateVocabulary deduplicates', () => {
    populateVocabulary(db, 'react react react typescript typescript');
    const vocab = loadVocabulary(db);
    expect(vocab.filter(w => w === 'react').length).toBe(1);
  });

  test('correctQuery corrects typos', () => {
    populateVocabulary(db, 'kubernetes typescript javascript react');
    const result = correctQuery(db, ['kuberntes']);
    expect(result).not.toBeNull();
    expect(result![0]).toBe('kubernetes');
  });

  test('correctQuery returns null when no corrections needed', () => {
    populateVocabulary(db, 'kubernetes typescript');
    const result = correctQuery(db, ['kubernetes']);
    expect(result).toBeNull();
  });

  test('correctQuery returns null with empty vocabulary', () => {
    const result = correctQuery(db, ['test']);
    expect(result).toBeNull();
  });
});
