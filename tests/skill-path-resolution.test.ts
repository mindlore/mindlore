import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('Skill script path resolution', () => {
  const mindlorePkg = path.resolve(__dirname, '..');
  const tmpDir = path.join(os.tmpdir(), `mindlore-path-res-${Date.now()}`);

  beforeEach(() => fs.mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test('scripts are reachable from a different CWD via MINDLORE_PKG', () => {
    const healthScript = path.join(mindlorePkg, 'dist', 'scripts', 'mindlore-health-check.js');
    expect(fs.existsSync(healthScript)).toBe(true);

    const result = execSync(
      `node "${healthScript}" "${path.join(os.homedir(), '.mindlore')}" 2>&1 || true`,
      { cwd: tmpDir, encoding: 'utf8', timeout: 15000 }
    );
    expect(result).not.toContain('Cannot find module');
  });

  test('skill preamble pattern resolves correctly', () => {
    const skillBase = path.join(mindlorePkg, 'skills', 'mindlore-diary');
    const resolvedPkg = path.resolve(skillBase, '..', '..');
    expect(resolvedPkg).toBe(mindlorePkg);
    expect(fs.existsSync(path.join(resolvedPkg, 'dist', 'scripts'))).toBe(true);
  });
});
