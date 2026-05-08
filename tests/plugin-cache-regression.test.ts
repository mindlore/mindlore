import path from 'path';

describe('plugin cache regression', () => {
  it('bundled hooks do not reference unbundled build artifacts', () => {
    const hookDir = path.join(__dirname, '..', 'hooks');
    const fs = require('fs');
    const hookFiles = fs.readdirSync(hookDir).filter((f: string) => f.endsWith('.cjs'));

    for (const file of hookFiles) {
      const content = fs.readFileSync(path.join(hookDir, file), 'utf8');
      // Bundled hooks should not require from dist/ (not shipped with plugin)
      expect(content).not.toMatch(/require\(["']\.\.\/dist\//);
    }
  });
});
