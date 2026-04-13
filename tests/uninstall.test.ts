import fs from 'fs';
import path from 'path';
import { readJsonFile } from '../scripts/lib/safe-parse.js';

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-uninstall');
const MOCK_HOME = path.join(TEST_DIR, 'home');
const MOCK_PROJECT = path.join(TEST_DIR, 'project');

interface HookEntry {
  type: string;
  command?: string;
}

interface HookGroup {
  hooks: HookEntry[];
}

interface Settings {
  hooks: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

interface ProjectSettings {
  projectDocFiles: string[];
  [key: string]: unknown;
}

function setupMockEnvironment(): void {
  const claudeDir = path.join(MOCK_HOME, '.claude');
  const skillsDir = path.join(claudeDir, 'skills');
  fs.mkdirSync(path.join(skillsDir, 'mindlore-ingest'), { recursive: true });
  fs.mkdirSync(path.join(skillsDir, 'mindlore-health'), { recursive: true });
  fs.mkdirSync(path.join(skillsDir, 'other-skill'), { recursive: true });

  fs.writeFileSync(path.join(skillsDir, 'mindlore-ingest', 'SKILL.md'), '# Ingest');
  fs.writeFileSync(path.join(skillsDir, 'mindlore-health', 'SKILL.md'), '# Health');
  fs.writeFileSync(path.join(skillsDir, 'other-skill', 'SKILL.md'), '# Other');

  const settings: Settings = {
    hooks: {
      SessionStart: [
        { hooks: [{ type: 'command', command: 'node some-other-hook.cjs' }] },
        { hooks: [{ type: 'command', command: 'node mindlore-session-focus.cjs' }] },
      ],
      UserPromptSubmit: [
        { hooks: [{ type: 'command', command: 'node mindlore-search.cjs' }] },
      ],
      SessionEnd: [
        { hooks: [{ type: 'command', command: 'node mindlore-session-end.cjs' }] },
      ],
    },
  };
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2));

  const projectClaude = path.join(MOCK_PROJECT, '.claude');
  const projectMindlore = path.join(MOCK_PROJECT, '.mindlore');
  fs.mkdirSync(path.join(projectMindlore, 'sources'), { recursive: true });
  fs.mkdirSync(projectClaude, { recursive: true });

  fs.writeFileSync(path.join(projectMindlore, 'INDEX.md'), '# Mindlore Index');
  fs.writeFileSync(
    path.join(projectClaude, 'settings.json'),
    JSON.stringify({ projectDocFiles: ['.mindlore/SCHEMA.md', 'other.md'] }),
  );
}

beforeEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  setupMockEnvironment();
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Uninstall Logic', () => {
  test('should remove mindlore hooks but keep other hooks', () => {
    const settingsPath = path.join(MOCK_HOME, '.claude', 'settings.json');
    const settings = readJsonFile<Settings>(settingsPath);
    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = (settings.hooks[event] ?? []).filter((entry) => {
        const hooks = entry.hooks ?? [];
        return !hooks.some((h) => (h.command ?? '').includes('mindlore-'));
      });
      if (settings.hooks[event]!.length === 0) {
        delete settings.hooks[event];
      }
    }

    expect(settings.hooks['SessionStart']).toHaveLength(1);
    expect(settings.hooks['SessionStart']![0]!.hooks[0]!.command).toContain('some-other-hook');
    expect(settings.hooks['UserPromptSubmit']).toBeUndefined();
    expect(settings.hooks['SessionEnd']).toBeUndefined();
  });

  test('should remove mindlore skills but keep other skills', () => {
    const skillsDir = path.join(MOCK_HOME, '.claude', 'skills');

    const before = fs.readdirSync(skillsDir);
    expect(before).toContain('mindlore-ingest');
    expect(before).toContain('mindlore-health');
    expect(before).toContain('other-skill');

    const mindloreSkills = before.filter((d) => d.startsWith('mindlore-'));
    for (const skill of mindloreSkills) {
      fs.rmSync(path.join(skillsDir, skill), { recursive: true });
    }

    const after = fs.readdirSync(skillsDir);
    expect(after).not.toContain('mindlore-ingest');
    expect(after).not.toContain('mindlore-health');
    expect(after).toContain('other-skill');
  });

  test('should remove SCHEMA.md from projectDocFiles but keep others', () => {
    const settingsPath = path.join(MOCK_PROJECT, '.claude', 'settings.json');
    const settings = readJsonFile<ProjectSettings>(settingsPath);

    expect(settings.projectDocFiles).toContain('.mindlore/SCHEMA.md');
    expect(settings.projectDocFiles).toContain('other.md');

    settings.projectDocFiles = settings.projectDocFiles.filter(
      (p) => !p.includes('mindlore'),
    );

    expect(settings.projectDocFiles).not.toContain('.mindlore/SCHEMA.md');
    expect(settings.projectDocFiles).toContain('other.md');
  });

  test('should remove .mindlore/ with --all flag', () => {
    const mindloreDir = path.join(MOCK_PROJECT, '.mindlore');
    expect(fs.existsSync(mindloreDir)).toBe(true);

    fs.rmSync(mindloreDir, { recursive: true, force: true });
    expect(fs.existsSync(mindloreDir)).toBe(false);
  });
});
