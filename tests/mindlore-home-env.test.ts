import path from 'path';
import os from 'os';

const { resolveMindloreHome } = require('../hooks/lib/mindlore-common.cjs');

test('resolveMindloreHome returns MINDLORE_HOME when set', () => {
  const saved = process.env.MINDLORE_HOME;
  try {
    process.env.MINDLORE_HOME = '/tmp/custom-mindlore';
    expect(resolveMindloreHome()).toBe('/tmp/custom-mindlore');
  } finally {
    if (saved === undefined) delete process.env.MINDLORE_HOME;
    else process.env.MINDLORE_HOME = saved;
  }
});

test('resolveMindloreHome falls back to ~/.mindlore', () => {
  const saved = process.env.MINDLORE_HOME;
  delete process.env.MINDLORE_HOME;
  try {
    expect(resolveMindloreHome()).toBe(path.join(os.homedir(), '.mindlore'));
  } finally {
    if (saved !== undefined) process.env.MINDLORE_HOME = saved;
  }
});
