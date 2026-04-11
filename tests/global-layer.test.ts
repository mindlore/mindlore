import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDb, setupTestDir, teardownTestDir } from './helpers/db';

const TEST_DIR = path.join(__dirname, '..', '.test-global-layer');
const FAKE_HOME = path.join(TEST_DIR, 'home');
const FAKE_PROJECT = path.join(TEST_DIR, 'project');
const GLOBAL_MINDLORE = path.join(FAKE_HOME, '.mindlore');
const PROJECT_MINDLORE = path.join(FAKE_PROJECT, '.mindlore');

// We test the CJS common module directly since hooks use it
const commonPath = path.resolve(__dirname, '..', 'hooks', 'lib', 'mindlore-common.cjs');

let homedirSpy: jest.SpyInstance;

function mockHomedir(): void {
  homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME);
  delete require.cache[require.resolve(commonPath)];
}

beforeEach(() => {
  setupTestDir(TEST_DIR);
  fs.mkdirSync(FAKE_HOME, { recursive: true });
  fs.mkdirSync(FAKE_PROJECT, { recursive: true });
});

afterEach(() => {
  if (homedirSpy) homedirSpy.mockRestore();
  delete require.cache[require.resolve(commonPath)];
  teardownTestDir(TEST_DIR);
});

describe('getActiveMindloreDir', () => {
  test('returns project dir when .mindlore/ exists in CWD', () => {
    fs.mkdirSync(PROJECT_MINDLORE, { recursive: true });

    const originalCwd = process.cwd();
    process.chdir(FAKE_PROJECT);
    try {
      const { getActiveMindloreDir } = require(commonPath);
      const result = getActiveMindloreDir();
      expect(result).toBe(PROJECT_MINDLORE);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('falls back to global when no .mindlore/ in CWD', () => {
    // No .mindlore/ in FAKE_PROJECT
    const originalCwd = process.cwd();
    process.chdir(FAKE_PROJECT);
    try {
      const { getActiveMindloreDir, GLOBAL_MINDLORE_DIR } = require(commonPath);
      const result = getActiveMindloreDir();
      expect(result).toBe(GLOBAL_MINDLORE_DIR);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('getAllDbs', () => {
  test('returns project DB first, then global DB', () => {
    fs.mkdirSync(PROJECT_MINDLORE, { recursive: true });
    fs.mkdirSync(GLOBAL_MINDLORE, { recursive: true });

    const projectDb = createTestDb(path.join(PROJECT_MINDLORE, 'mindlore.db'));
    projectDb.close();
    const globalDb = createTestDb(path.join(GLOBAL_MINDLORE, 'mindlore.db'));
    globalDb.close();

    mockHomedir();

    const originalCwd = process.cwd();
    process.chdir(FAKE_PROJECT);
    try {
      const { getAllDbs } = require(commonPath);
      const dbs = getAllDbs();
      expect(dbs).toHaveLength(2);
      expect(dbs[0]).toContain(path.join('project', '.mindlore'));
      expect(dbs[1]).toContain(path.join('home', '.mindlore'));
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('returns only project DB when global does not exist', () => {
    fs.mkdirSync(PROJECT_MINDLORE, { recursive: true });
    const projectDb = createTestDb(path.join(PROJECT_MINDLORE, 'mindlore.db'));
    projectDb.close();

    mockHomedir();

    const originalCwd = process.cwd();
    process.chdir(FAKE_PROJECT);
    try {
      const { getAllDbs } = require(commonPath);
      const dbs = getAllDbs();
      expect(dbs).toHaveLength(1);
      expect(dbs[0]).toContain('project');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('returns only global DB when project does not exist', () => {
    fs.mkdirSync(GLOBAL_MINDLORE, { recursive: true });
    const globalDb = createTestDb(path.join(GLOBAL_MINDLORE, 'mindlore.db'));
    globalDb.close();

    mockHomedir();

    const originalCwd = process.cwd();
    process.chdir(FAKE_PROJECT);
    try {
      const { getAllDbs } = require(commonPath);
      const dbs = getAllDbs();
      expect(dbs).toHaveLength(1);
      expect(dbs[0]).toContain('home');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('returns empty array when no DBs exist', () => {
    mockHomedir();

    const originalCwd = process.cwd();
    process.chdir(FAKE_PROJECT);
    try {
      const { getAllDbs } = require(commonPath);
      const dbs = getAllDbs();
      expect(dbs).toHaveLength(0);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('globalDir', () => {
  test('returns path based on os.homedir()', () => {
    mockHomedir();
    const { globalDir } = require(commonPath);
    expect(globalDir()).toBe(path.join(FAKE_HOME, '.mindlore'));
  });
});

describe('findMindloreDir backward compat', () => {
  test('returns null when neither project nor global exists', () => {
    mockHomedir();

    const originalCwd = process.cwd();
    process.chdir(FAKE_PROJECT);
    try {
      const { findMindloreDir } = require(commonPath);
      expect(findMindloreDir()).toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
