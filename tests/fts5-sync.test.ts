describe('fts5-sync guard', () => {
  it('skips non-.md trigger files', () => {
    const { shouldIndexFile } = require('../hooks/mindlore-fts5-sync.cjs');
    expect(shouldIndexFile('/path/to/file.ts')).toBe(false);
  });

  it('processes .md trigger files', () => {
    const { shouldIndexFile } = require('../hooks/mindlore-fts5-sync.cjs');
    expect(shouldIndexFile('/path/to/file.md')).toBe(true);
  });

  it('handles empty/undefined path', () => {
    const { shouldIndexFile } = require('../hooks/mindlore-fts5-sync.cjs');
    expect(shouldIndexFile('')).toBe(false);
    expect(shouldIndexFile(undefined)).toBe(false);
  });
});
