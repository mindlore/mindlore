import { readFileSync } from 'fs';
import path from 'path';

test('init.ts runs wal_checkpoint(TRUNCATE) before auto-index spawn', () => {
  const src = readFileSync(path.join(__dirname, '..', 'scripts', 'init.ts'), 'utf8');
  const idx = src.indexOf("execFileSync('node', [indexScript]");
  expect(idx).toBeGreaterThan(-1);
  const pre = src.slice(Math.max(0, idx - 500), idx);
  expect(pre).toMatch(/wal_checkpoint\(TRUNCATE\)/);
});

test('init.ts writes structured error to init.log on auto-index failure', () => {
  const src = readFileSync(path.join(__dirname, '..', 'scripts', 'init.ts'), 'utf8');
  expect(src).toMatch(/init\.log/);
  expect(src).toMatch(/child stderr/);
  expect(src).toMatch(/auto-index error/);
});
