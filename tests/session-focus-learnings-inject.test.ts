import path from 'path';
import os from 'os';
import fs from 'fs';
import { spawnSync } from 'child_process';

let tmpHome: string;
let mindloreDir: string;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-learnings-'));
  mindloreDir = path.join(tmpHome, '.mindlore');
  fs.mkdirSync(path.join(mindloreDir, 'learnings'), { recursive: true });
  fs.writeFileSync(
    path.join(mindloreDir, 'learnings', 'sample.md'),
    '---\nproject: global\n---\n\n## Sample Rule\n- Always do X\n- Never do Y'
  );
});

afterAll(() => { fs.rmSync(tmpHome, { recursive: true, force: true }); });

test('session-focus injects [Mindlore Learnings] when lessons exist', () => {
  const hook = path.join(__dirname, '..', 'hooks', 'mindlore-session-focus.cjs');
  const r = spawnSync('node', [hook], {
    env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome, MINDLORE_HOME: mindloreDir },
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
  });
  expect(r.stdout).toContain('[Mindlore Learnings]');
  expect(r.stdout).toContain('## Sample Rule');
});
