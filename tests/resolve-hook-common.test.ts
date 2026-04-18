import path from 'path';
import fs from 'fs';
import { resolveHookCommon } from '../scripts/lib/constants';

describe('resolveHookCommon', () => {
  it('resolves from scripts/lib/ (source)', () => {
    const result = resolveHookCommon(path.join(__dirname, '..', 'scripts', 'lib'));
    expect(fs.existsSync(result)).toBe(true);
    expect(result).toContain('mindlore-common.cjs');
  });

  it('resolves from dist/scripts/lib/ (compiled)', () => {
    const distDir = path.join(__dirname, '..', 'dist', 'scripts', 'lib');
    if (fs.existsSync(distDir)) {
      const result = resolveHookCommon(distDir);
      expect(fs.existsSync(result)).toBe(true);
      expect(result).toContain('mindlore-common.cjs');
    }
  });

  it('resolves from deeply nested dist path', () => {
    const projectRoot = path.join(__dirname, '..');
    const fakeDeep = path.join(projectRoot, 'dist', 'scripts', 'lib');
    const result = resolveHookCommon(fakeDeep);
    expect(result).toContain('mindlore-common.cjs');
  });
});
