import fs from 'fs';
import path from 'path';

function readJsonVersion(filePath: string, ...keys: string[]): string {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let value = content;
  for (const key of keys) {
    value = value[key];
  }
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON traversal returns any */
  return value as string;
}

describe('Version Sync', () => {
  const root = path.resolve(__dirname, '..');

  const versions = () => ({
    packageJson: readJsonVersion(path.join(root, 'package.json'), 'version'),
    pluginJson: readJsonVersion(path.join(root, 'plugin.json'), 'version'),
    claudePluginJson: readJsonVersion(path.join(root, '.claude-plugin', 'plugin.json'), 'version'),
    marketplaceMeta: readJsonVersion(path.join(root, '.claude-plugin', 'marketplace.json'), 'metadata', 'version'),
    marketplacePlugin: readJsonVersion(path.join(root, '.claude-plugin', 'marketplace.json'), 'plugins', '0', 'version'),
  });

  it('all 5 version fields are equal', () => {
    const v = versions();
    const allVersions = Object.values(v);
    const unique = new Set(allVersions);

    expect(unique.size).toBe(1);
    // Extra detail on failure
    if (unique.size !== 1) {
      console.log('Version mismatch:', v);
    }
  });

  it('version matches semver pattern', () => {
    const v = versions();
    expect(v.packageJson).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
