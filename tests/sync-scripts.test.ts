import path from 'path';
import os from 'os';
import fs from 'fs';

const { getSyncScripts } = require('../hooks/lib/sync-scripts.cjs');

let tmpHooks: string;

beforeEach(() => {
  tmpHooks = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-scripts-'));
  fs.writeFileSync(path.join(tmpHooks, 'mindlore-search.cjs'), '');
  fs.writeFileSync(path.join(tmpHooks, 'mindlore-session-focus.cjs'), '');
  fs.writeFileSync(path.join(tmpHooks, 'other-hook.cjs'), '');
  fs.writeFileSync(path.join(tmpHooks, 'mindlore-search.js'), '');
});

afterEach(() => { fs.rmSync(tmpHooks, { recursive: true, force: true }); });

test('getSyncScripts returns only mindlore-*.cjs', () => {
  const list = getSyncScripts(tmpHooks);
  expect(list.map((p: string) => path.basename(p)).sort()).toEqual([
    'mindlore-search.cjs',
    'mindlore-session-focus.cjs',
  ]);
});
