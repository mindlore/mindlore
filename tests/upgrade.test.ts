import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TEST_PROJECT = path.join(__dirname, '..', '.test-upgrade');
const INIT_SCRIPT = path.join(__dirname, '..', 'dist', 'scripts', 'init.js');

beforeEach(() => {
  fs.mkdirSync(TEST_PROJECT, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_PROJECT, { recursive: true, force: true });
});

describe('version-aware upgrade', () => {
  test('init writes .version file', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    const versionPath = path.join(TEST_PROJECT, '.mindlore', '.version');
    expect(fs.existsSync(versionPath)).toBe(true);

    const version = fs.readFileSync(versionPath, 'utf8').trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('re-running init updates .version file', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // Write old version
    const versionPath = path.join(TEST_PROJECT, '.mindlore', '.version');
    fs.writeFileSync(versionPath, '0.1.0', 'utf8');

    // Re-run init
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    const version = fs.readFileSync(versionPath, 'utf8').trim();
    expect(version).not.toBe('0.1.0');
  });

  test('init preserves existing data during upgrade', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // Add custom data
    const testFile = path.join(TEST_PROJECT, '.mindlore', 'sources', 'test.md');
    fs.writeFileSync(testFile, '---\nslug: test\ntype: source\n---\n# Test Source\n');

    // Re-run init (upgrade)
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // Custom data preserved
    expect(fs.existsSync(testFile)).toBe(true);
    expect(fs.readFileSync(testFile, 'utf8')).toContain('# Test Source');
  });

  test('session-focus injects version warning when mismatch', () => {
    const env = { ...process.env, HOME: TEST_PROJECT, USERPROFILE: TEST_PROJECT };

    // Init first
    execSync(`node "${INIT_SCRIPT}" init`, {
      cwd: TEST_PROJECT,
      stdio: 'pipe',
      env,
    });

    // Set old version to trigger warning
    const versionPath = path.join(TEST_PROJECT, '.mindlore', '.version');
    fs.writeFileSync(versionPath, '0.0.1', 'utf8');

    // Run session-focus hook
    const focusScript = path.resolve(__dirname, '..', 'hooks', 'mindlore-session-focus.cjs');
    const output = execSync(`node "${focusScript}"`, {
      cwd: TEST_PROJECT,
      encoding: 'utf8',
      env,
    });

    expect(output).toContain('Guncelleme mevcut');
    expect(output).toContain('0.0.1');
  });
});
