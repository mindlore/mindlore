import fs from 'fs';
import path from 'path';

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function fileContainsPluginCache(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf8');
  // Match '.claude', 'plugins', 'cache' appearing in sequence (with any chars between)
  return /['"]\.claude['"][\s\S]*?['"]plugins['"][\s\S]*?['"]cache['"]/.test(content);
}

test('no hardcoded plugin cache path outside constants.ts', () => {
  const scriptsDir = path.join(__dirname, '..', 'scripts');
  const files = findTsFiles(scriptsDir);
  const violations: string[] = [];

  for (const file of files) {
    const relative = path.relative(path.join(__dirname, '..'), file);
    if (relative.replace(/\\/g, '/') === 'scripts/lib/constants.ts') continue;
    if (fileContainsPluginCache(file)) {
      violations.push(relative);
    }
  }

  expect(violations).toEqual([]);
});
