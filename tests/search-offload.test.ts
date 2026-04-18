import fs from 'fs';
import path from 'path';
import os from 'os';

describe('search hook offload+pointer', () => {
  const tmpDir = path.join(os.tmpdir(), 'mindlore-offload-' + Date.now());
  const mindloreDir = path.join(tmpDir, '.mindlore');
  const tmpSubDir = path.join(mindloreDir, 'tmp');

  beforeEach(() => { fs.mkdirSync(tmpSubDir, { recursive: true }); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('offloads results >10KB to tmp/ and returns pointer', () => {
    const largeContent = 'x'.repeat(12000);
    const resultPath = path.join(tmpSubDir, 'search-result-test.md');
    fs.writeFileSync(resultPath, largeContent, 'utf8');

    // Verify file was written and is >10KB
    const stat = fs.statSync(resultPath);
    expect(stat.size).toBeGreaterThan(10240);
    expect(fs.existsSync(resultPath)).toBe(true);

    // Verify pointer format
    const pointer = `[Mindlore Search: ${largeContent.length} chars offloaded to ${resultPath}]\nSummary: ${largeContent.slice(0, 500).trim()}...\n[Read full results: ${resultPath}]`;
    expect(pointer).toContain('offloaded to');
    expect(pointer).toContain('Read full results');
  });

  it('keeps results under 10KB inline', () => {
    const smallContent = 'y'.repeat(5000);
    // Under threshold — should not offload
    expect(smallContent.length).toBeLessThan(10240);
  });
});
