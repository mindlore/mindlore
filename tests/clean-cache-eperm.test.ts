import { describe, test, expect, jest } from '@jest/globals';
import * as path from 'path';
import * as os from 'os';

const mockRmSync = jest.fn();

jest.mock('fs', () => ({
  ...(jest.requireActual('fs') as Record<string, unknown>),
  rmSync: mockRmSync,
}));

// After mocking, import fs (it will use the mocked rmSync)
import * as fs from 'fs';
import { cleanCacheVersions } from '../scripts/mindlore-clean-cache';

describe('clean-cache EPERM handling (B4-a)', () => {
  afterEach(() => {
    mockRmSync.mockReset();
  });

  test('continues on EPERM, returns skipped versions', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-test-'));
    const v1 = path.join(tmpDir, '0.7.5');
    const v2 = path.join(tmpDir, '0.7.6');
    fs.mkdirSync(v1, { recursive: true });
    fs.mkdirSync(v2, { recursive: true });
    fs.writeFileSync(path.join(v1, 'native.node'), 'fake binary');

    // Mock rmSync: throw EPERM for v1, succeed for v2
    mockRmSync.mockImplementation((p) => {
      if (p === v1) {
        const err: NodeJS.ErrnoException = new Error('EPERM');
        err.code = 'EPERM';
        throw err;
      }
      // For v2 and tmpDir cleanup, call real rmSync
      return (jest.requireActual('fs') as typeof fs).rmSync(p, { recursive: true, force: true });
    });

    const result = cleanCacheVersions([v1, v2]);

    expect(result.cleaned).toEqual([v2]);
    expect(result.skipped).toContainEqual({ version: v1, reason: 'EPERM' });

    // Cleanup
    (jest.requireActual('fs') as typeof fs).rmSync(tmpDir, { recursive: true, force: true });
  });
});
