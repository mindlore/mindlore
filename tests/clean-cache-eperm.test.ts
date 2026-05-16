import { describe, it, expect, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as typeof fs;
  let callCount = 0;
  return {
    ...actual,
    rmSync: (p: string, opts?: object) => {
      callCount++;
      if (callCount === 2) {
        const err: NodeJS.ErrnoException = new Error('EPERM');
        err.code = 'EPERM';
        throw err;
      }
      return actual.rmSync(p, opts);
    },
  };
});

import { cleanCacheVersion } from '../scripts/mindlore-clean-cache';

describe('clean-cache EPERM resilience', () => {
  it('skips locked version and continues to next without crashing', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mlc-'));
    fs.mkdirSync(path.join(tmpRoot, '0.7.3'));
    fs.mkdirSync(path.join(tmpRoot, '0.7.4'));
    fs.mkdirSync(path.join(tmpRoot, '0.7.5'));
    const result = cleanCacheVersion(tmpRoot);
    expect(result.skipped).toContain('0.7.4');
    expect(result.cleaned).toContain('0.7.3');
    expect(fs.existsSync(path.join(tmpRoot, '0.7.3'))).toBe(false);
    expect(fs.existsSync(path.join(tmpRoot, '0.7.5'))).toBe(true); // latest preserved
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});
