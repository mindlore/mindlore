import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import { dbAll } from './db-helpers.js';

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const prev = new Int32Array(n + 1);
  const curr = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]!
        : 1 + Math.min(prev[j]!, curr[j - 1]!, prev[j - 1]!);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

function maxDistance(wordLen: number): number {
  if (wordLen <= 4) return 1;
  if (wordLen <= 7) return 2;
  return 3;
}

export function findClosestWords(word: string, vocabulary: string[], limit = 3): string[] {
  const maxDist = maxDistance(word.length);
  const lower = word.toLowerCase();
  const candidates: Array<{ word: string; dist: number }> = [];
  for (const v of vocabulary) {
    if (Math.abs(v.length - lower.length) > maxDist) continue;
    const dist = levenshtein(lower, v.toLowerCase());
    if (dist > 0 && dist <= maxDist) {
      candidates.push({ word: v, dist });
    }
  }
  return candidates.sort((a, b) => a.dist - b.dist).slice(0, limit).map(c => c.word);
}

let vocabCache: { dbName: string; words: string[] } | null = null;

export function loadVocabulary(db: Database): string[] {
  const dbName = db.name;
  if (vocabCache && vocabCache.dbName === dbName) return vocabCache.words;
  const words = dbAll<{ word: string }>(db, 'SELECT word FROM vocabulary').map(r => r.word);
  vocabCache = { dbName, words };
  return words;
}

export function invalidateVocabCache(): void {
  vocabCache = null;
}

export function populateVocabulary(db: Database, content: string): void {
  const words = content
    .replace(/[^\w\sçğıöşüÇĞİÖŞÜ-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .map(w => w.toLowerCase());
  const unique = [...new Set(words)];
  const stmt = db.prepare('INSERT OR IGNORE INTO vocabulary (word) VALUES (?)');
  for (const w of unique) stmt.run(w);
}

export function correctQuery(db: Database, keywords: string[]): string[] | null {
  const vocab = loadVocabulary(db);
  if (vocab.length === 0) return null;
  let corrected = false;
  const result: string[] = keywords.map(kw => {
    const closest = findClosestWords(kw, vocab, 1);
    const match = closest[0];
    if (match !== undefined && match !== kw) {
      corrected = true;
      return match;
    }
    return kw;
  });
  return corrected ? result : null;
}
