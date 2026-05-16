import * as fs from 'fs';
import * as path from 'path';

describe('ingest SKILL.md type-aware extraction (docs-presence)', () => {
  const skillPath = path.join(__dirname, '..', 'skills', 'mindlore-ingest', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf8');

  it('documents github-repo template fields', () => {
    expect(content).toMatch(/### github-repo[\s\S]*Tech Stack[\s\S]*Key Features[\s\S]*Setup[\s\S]*License/);
  });
  it('documents cc-session template fields', () => {
    expect(content).toMatch(/### cc-session[\s\S]*Decisions[\s\S]*Patterns[\s\S]*Actionable Items[\s\S]*Open Questions/);
  });
});
