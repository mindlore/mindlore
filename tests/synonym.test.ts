import { expandQuery, loadSynonyms } from '../scripts/lib/synonym.js';

describe('Synonym Expansion', () => {
  const synonyms = {
    auth: ['authentication', 'login', 'kimlik doğrulama'],
    güvenlik: ['security', 'hardening', 'sertleştirme'],
    db: ['database', 'veritabanı', 'sqlite'],
  };

  test('should expand known synonym', () => {
    const result = expandQuery('auth token', synonyms);
    expect(result).toContain('auth');
    expect(result).toContain('authentication');
    expect(result).toContain('login');
    expect(result).toContain('token');
  });

  test('should not duplicate original term', () => {
    const result = expandQuery('auth', synonyms);
    const authCount = result.filter(t => t === 'auth').length;
    expect(authCount).toBe(1);
  });

  test('should handle Turkish synonyms', () => {
    const result = expandQuery('güvenlik audit', synonyms);
    expect(result).toContain('güvenlik');
    expect(result).toContain('security');
    expect(result).toContain('hardening');
    expect(result).toContain('audit');
  });

  test('should return original terms when no synonyms match', () => {
    const result = expandQuery('typescript hooks', synonyms);
    expect(result).toEqual(['typescript', 'hooks']);
  });

  test('should handle empty input', () => {
    const result = expandQuery('', synonyms);
    expect(result).toEqual([]);
  });

  test('should load synonyms from config object', () => {
    const config = { synonyms };
    const loaded = loadSynonyms(config);
    expect(loaded).toEqual(synonyms);
  });

  test('should return empty object when config has no synonyms', () => {
    const loaded = loadSynonyms({});
    expect(loaded).toEqual({});
  });
});
