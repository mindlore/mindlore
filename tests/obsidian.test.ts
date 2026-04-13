import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TEST_DIR = path.join(__dirname, '..', '.test-obsidian');
const MINDLORE_DIR = path.join(TEST_DIR, '.mindlore');
const VAULT_DIR = path.join(TEST_DIR, 'vault');
const OBSIDIAN_SCRIPT = path.resolve(__dirname, '..', 'dist', 'scripts', 'mindlore-obsidian.js');

function runObsidian(args: string): string {
  try {
    return execSync(`node "${OBSIDIAN_SCRIPT}" ${args}`, {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, MINDLORE_HOME: MINDLORE_DIR },
    });
  } catch (err) {
    return (err as { stdout?: string }).stdout || '';
  }
}

beforeEach(() => {
  // Create mindlore dir with some content
  fs.mkdirSync(path.join(MINDLORE_DIR, 'domains'), { recursive: true });
  fs.mkdirSync(path.join(MINDLORE_DIR, 'sources'), { recursive: true });
  fs.mkdirSync(path.join(MINDLORE_DIR, 'raw'), { recursive: true });
  fs.writeFileSync(
    path.join(MINDLORE_DIR, 'config.json'),
    JSON.stringify({ version: '0.3.3' }),
    'utf8',
  );
  fs.writeFileSync(
    path.join(MINDLORE_DIR, 'domains', 'test-domain.md'),
    '---\nslug: test-domain\ntype: domain\n---\n\n# Test Domain\n\nSee [source](../sources/test-source.md) for details.\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(MINDLORE_DIR, 'sources', 'test-source.md'),
    '---\nslug: test-source\ntype: source\n---\n\n# Test Source\n',
    'utf8',
  );

  // Create vault with .obsidian/
  fs.mkdirSync(path.join(VAULT_DIR, '.obsidian'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('mindlore obsidian', () => {
  describe('export', () => {
    test('exports md files to vault/mindlore/', () => {
      runObsidian(`export --vault "${VAULT_DIR}"`);

      const exported = path.join(VAULT_DIR, 'mindlore', 'domains', 'test-domain.md');
      expect(fs.existsSync(exported)).toBe(true);
    });

    test('converts markdown links to wikilinks', () => {
      runObsidian(`export --vault "${VAULT_DIR}"`);

      const exported = path.join(VAULT_DIR, 'mindlore', 'domains', 'test-domain.md');
      const content = fs.readFileSync(exported, 'utf8');
      expect(content).toContain('[[test-source]]');
      expect(content).not.toContain('../sources/test-source.md');
    });

    test('skips unchanged files on re-export', () => {
      runObsidian(`export --vault "${VAULT_DIR}"`);
      const output = runObsidian(`export --vault "${VAULT_DIR}"`);

      expect(output).toContain('skipped');
    });

    test('force flag re-exports all files', () => {
      runObsidian(`export --vault "${VAULT_DIR}"`);
      const output = runObsidian(`export --vault "${VAULT_DIR}" --force`);

      expect(output).toContain('Exported: 2');
    });

    test('skips config.json and INDEX.md', () => {
      fs.writeFileSync(path.join(MINDLORE_DIR, 'INDEX.md'), '# Index\n', 'utf8');

      runObsidian(`export --vault "${VAULT_DIR}"`);

      expect(fs.existsSync(path.join(VAULT_DIR, 'mindlore', 'config.json'))).toBe(false);
      expect(fs.existsSync(path.join(VAULT_DIR, 'mindlore', 'INDEX.md'))).toBe(false);
    });

    test('updates obsidian config after export', () => {
      runObsidian(`export --vault "${VAULT_DIR}"`);

      const config = JSON.parse(fs.readFileSync(path.join(MINDLORE_DIR, 'config.json'), 'utf8'));
      expect(config.obsidian).toBeDefined();
      expect(config.obsidian.vault).toBe(VAULT_DIR);
      expect(config.obsidian.lastExport).toBeTruthy();
    });
  });

  describe('import', () => {
    test('imports md files from vault to raw/', () => {
      // Create a note in vault
      fs.writeFileSync(
        path.join(VAULT_DIR, 'my-note.md'),
        '# My Obsidian Note\n\nSome content.\n',
        'utf8',
      );

      runObsidian(`import --vault "${VAULT_DIR}"`);

      const imported = path.join(MINDLORE_DIR, 'raw', 'my-note.md');
      expect(fs.existsSync(imported)).toBe(true);
    });

    test('adds frontmatter to imported files without it', () => {
      fs.writeFileSync(
        path.join(VAULT_DIR, 'plain-note.md'),
        '# Plain Note\n\nNo frontmatter.\n',
        'utf8',
      );

      runObsidian(`import --vault "${VAULT_DIR}"`);

      const content = fs.readFileSync(path.join(MINDLORE_DIR, 'raw', 'plain-note.md'), 'utf8');
      expect(content).toContain('source: obsidian-vault');
      expect(content).toContain('type: raw');
    });

    test('preserves existing frontmatter', () => {
      fs.writeFileSync(
        path.join(VAULT_DIR, 'with-fm.md'),
        '---\ntitle: My Note\n---\n\n# With Frontmatter\n',
        'utf8',
      );

      runObsidian(`import --vault "${VAULT_DIR}"`);

      const content = fs.readFileSync(path.join(MINDLORE_DIR, 'raw', 'with-fm.md'), 'utf8');
      expect(content).toContain('title: My Note');
      // Should NOT double-add frontmatter
      const fmCount = (content.match(/---/g) || []).length;
      expect(fmCount).toBe(2);
    });

    test('imports from specific folder with --folder', () => {
      const subDir = path.join(VAULT_DIR, 'notes', 'ai');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'ai-note.md'), '# AI Note\n', 'utf8');

      // Also create a file in vault root that should NOT be imported
      fs.writeFileSync(path.join(VAULT_DIR, 'root-note.md'), '# Root\n', 'utf8');

      runObsidian(`import --vault "${VAULT_DIR}" --folder notes/ai`);

      expect(fs.existsSync(path.join(MINDLORE_DIR, 'raw', 'ai-note.md'))).toBe(true);
      expect(fs.existsSync(path.join(MINDLORE_DIR, 'raw', 'root-note.md'))).toBe(false);
    });

    test('skips .obsidian/ directory files', () => {
      fs.writeFileSync(
        path.join(VAULT_DIR, '.obsidian', 'config.md'),
        '# Config\n',
        'utf8',
      );
      fs.writeFileSync(path.join(VAULT_DIR, 'note.md'), '# Note\n', 'utf8');

      runObsidian(`import --vault "${VAULT_DIR}"`);

      expect(fs.existsSync(path.join(MINDLORE_DIR, 'raw', 'config.md'))).toBe(false);
      expect(fs.existsSync(path.join(MINDLORE_DIR, 'raw', 'note.md'))).toBe(true);
    });
  });

  describe('status', () => {
    test('shows no vault when not configured', () => {
      const output = runObsidian('status');
      expect(output).toContain('No vault configured');
    });

    test('shows vault info after export', () => {
      runObsidian(`export --vault "${VAULT_DIR}"`);
      const output = runObsidian('status');

      expect(output).toContain('Vault:');
      expect(output).toContain('Last export:');
    });
  });

  describe('helpers', () => {
    test('shows usage when no subcommand given', () => {
      const output = runObsidian('');
      expect(output).toContain('Usage');
    });
  });
});
