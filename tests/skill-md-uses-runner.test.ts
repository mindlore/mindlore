import fs from 'fs';
import path from 'path';

const skillsDir = path.join(__dirname, '..', 'skills');

test('every SKILL.md that calls a script goes through skill-runner', () => {
  const skills = fs.readdirSync(skillsDir);
  const violations: string[] = [];
  for (const skill of skills) {
    const md = path.join(skillsDir, skill, 'SKILL.md');
    if (!fs.existsSync(md)) continue;
    const src = fs.readFileSync(md, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
        const m = line.match(/node "?\$MINDLORE_PKG\/dist\/scripts\/([^"\s]+)/);
        if (m && !line.includes('skill-runner')) {
        violations.push(`${skill}/SKILL.md:${i + 1} calls ${m[1]} without skill-runner`);
      }
    }
  }
  if (violations.length > 0) {
    console.error('Violations:\n' + violations.join('\n'));
  }
  expect(violations).toEqual([]);
});
