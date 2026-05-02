import fs from 'fs';
import path from 'path';

const SKILL_DIR = path.join(__dirname, '..', 'skills', 'mindlore-stats');
const SKILL_FILE = path.join(SKILL_DIR, 'SKILL.md');
const PLUGIN_JSON = path.join(__dirname, '..', 'plugin.json');

describe('/mindlore-stats skill', () => {
  let skillContent: string;
  let pluginData: Record<string, unknown>;

  beforeAll(() => {
    skillContent = fs.readFileSync(SKILL_FILE, 'utf8');
    pluginData = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
  });

  test('skill directory exists', () => {
    expect(fs.existsSync(SKILL_DIR)).toBe(true);
  });

  test('SKILL.md exists and is non-empty', () => {
    expect(skillContent.length).toBeGreaterThan(100);
  });

  test('SKILL.md has valid frontmatter', () => {
    expect(skillContent.startsWith('---')).toBe(true);
    const endIdx = skillContent.indexOf('---', 3);
    expect(endIdx).toBeGreaterThan(3);
    const frontmatter = skillContent.slice(3, endIdx);
    expect(frontmatter).toContain('name: mindlore-stats');
    expect(frontmatter).toContain('description:');
  });

  test('SKILL.md specifies fork context', () => {
    expect(skillContent).toContain('context: fork');
  });

  test('SKILL.md references telemetry.jsonl', () => {
    expect(skillContent).toContain('telemetry.jsonl');
  });

  test('SKILL.md references mindlore.db', () => {
    expect(skillContent).toContain('mindlore.db');
  });

  test('registered in plugin.json', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pluginData parsed from JSON
    const skills = pluginData.skills as Array<Record<string, string>>;
    const statsSkill = skills.find(s =>
      s.name === 'mindlore-stats' || s.path?.includes('mindlore-stats'),
    );
    expect(statsSkill).toBeDefined();
  });

  test('allowed-tools are restricted to read-only', () => {
    const toolsMatch = skillContent.match(/allowed-tools:\s*\[([^\]]+)\]/);
    expect(toolsMatch).toBeTruthy();
    const tools = toolsMatch![1]!.split(',').map(t => t.trim());
    expect(tools).not.toContain('Write');
    expect(tools).not.toContain('Edit');
  });
});
