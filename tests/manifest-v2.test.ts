import { validateManifest } from '../scripts/lib/validate-manifest.js';

describe('validate-manifest', () => {
  const validV2 = {
    manifestVersion: 2,
    name: 'mindlore',
    version: '0.6.9',
    description: 'AI-native knowledge system',
    skills: [],
    hooks: [],
  };

  it('accepts valid v2 manifest', () => {
    const result = validateManifest(validV2);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts v1 manifest (no manifestVersion field)', () => {
    const v1 = { name: 'test', description: 'test plugin', skills: [], hooks: [] };
    const result = validateManifest(v1);
    expect(result.valid).toBe(true);
    expect(result.manifestVersion).toBe(1);
  });

  it('rejects missing name', () => {
    const bad = { ...validV2, name: undefined };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/name/i);
  });

  it('rejects invalid version format', () => {
    const bad = { ...validV2, version: 'not-semver' };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/version/i);
  });

  it('rejects invalid manifestVersion', () => {
    const bad = { ...validV2, manifestVersion: 99 };
    const result = validateManifest(bad);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/manifestVersion/i);
  });

  it('accepts optional fields when missing', () => {
    const withOptionals = { ...validV2, minCCVersion: '2.1.0', conflicts: ['other'] };
    delete (withOptionals as Record<string,unknown>).minCCVersion;
    delete (withOptionals as Record<string,unknown>).conflicts;
    const result = validateManifest(withOptionals);
    expect(result.valid).toBe(true);
  });

  it('validates minCCVersion format when present', () => {
    const withCC = { ...validV2, minCCVersion: '2.1.100' };
    expect(validateManifest(withCC).valid).toBe(true);

    const badCC = { ...validV2, minCCVersion: 'abc' };
    expect(validateManifest(badCC).valid).toBe(false);
  });

  it('validates conflicts is array of strings', () => {
    const good = { ...validV2, conflicts: ['other-plugin'] };
    expect(validateManifest(good).valid).toBe(true);

    const bad = { ...validV2, conflicts: [123] };
    expect(validateManifest(bad).valid).toBe(false);
  });

  it('validates skills have name and path', () => {
    const good = { ...validV2, skills: [{ name: 'test', path: 'skills/test/SKILL.md', description: 'desc' }] };
    expect(validateManifest(good).valid).toBe(true);

    const bad = { ...validV2, skills: [{ name: 'test' }] };
    expect(validateManifest(bad).valid).toBe(false);
  });

  it('validates hooks have event and script', () => {
    const good = { ...validV2, hooks: [{ event: 'SessionStart', script: 'hooks/test.cjs' }] };
    expect(validateManifest(good).valid).toBe(true);

    const bad = { ...validV2, hooks: [{ event: 'SessionStart' }] };
    expect(validateManifest(bad).valid).toBe(false);
  });
});
