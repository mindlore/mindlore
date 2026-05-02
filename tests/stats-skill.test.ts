import fs from 'fs';
import path from 'path';

const SKILL_DIR = path.join(__dirname, '..', 'skills', 'mindlore-stats');
const SKILL_FILE = path.join(SKILL_DIR, 'SKILL.md');
const PLUGIN_JSON = path.join(__dirname, '..', 'plugin.json');

describe('/mindlore-stats skill', () => {
  test('skill directory exists', () => {
    expect(fs.existsSync(SKILL_DIR)).toBe(true);
  });

  test('SKILL.md exists and is non-empty', () => {
    expect(fs.existsSync(SKILL_FILE)).toBe(true);
    const content = fs.readFileSync(SKILL_FILE, 'utf8');
    expect(content.length).toBeGreaterThan(100);
  });

  test('SKILL.md has valid frontmatter', () => {
    const content = fs.readFileSync(SKILL_FILE, 'utf8');
    expect(content.startsWith('---')).toBe(true);
    const endIdx = content.indexOf('---', 3);
    expect(endIdx).toBeGreaterThan(3);
    const frontmatter = content.slice(3, endIdx);
    expect(frontmatter).toContain('name: mindlore-stats');
    expect(frontmatter).toContain('description:');
  });

  test('SKILL.md specifies fork context', () => {
    const content = fs.readFileSync(SKILL_FILE, 'utf8');
    expect(content).toContain('context: fork');
  });

  test('SKILL.md references telemetry.jsonl', () => {
    const content = fs.readFileSync(SKILL_FILE, 'utf8');
    expect(content).toContain('telemetry.jsonl');
  });

  test('SKILL.md references mindlore.db', () => {
    const content = fs.readFileSync(SKILL_FILE, 'utf8');
    expect(content).toContain('mindlore.db');
  });

  test('registered in plugin.json', () => {
    const plugin = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
    const statsSkill = plugin.skills.find((s: Record<string, string>) =>
      s.name === 'mindlore-stats' || s.path?.includes('mindlore-stats'),
    );
    expect(statsSkill).toBeDefined();
  });

  test('allowed-tools are restricted to read-only', () => {
    const content = fs.readFileSync(SKILL_FILE, 'utf8');
    const toolsMatch = content.match(/allowed-tools:\s*\[([^\]]+)\]/);
    expect(toolsMatch).toBeTruthy();
    const tools = toolsMatch![1]!.split(',').map(t => t.trim());
    expect(tools).not.toContain('Write');
    expect(tools).not.toContain('Edit');
  });
});
