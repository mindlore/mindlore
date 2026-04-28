import { extractSessionSummary } from '../scripts/cc-session-sync.js';

const DECISION_KEYWORDS_TR = ['karar:', 'ertele', 'seçtik', 'yapma:'];
const DECISION_KEYWORDS_EN = ['decision:', 'defer', 'chose', 'skip:'];
const ALL_KEYWORDS = [...DECISION_KEYWORDS_TR, ...DECISION_KEYWORDS_EN];

describe('session summary extraction', () => {
  it('extracts intent from first user message', () => {
    const transcript = [
      '---',
      'type: raw',
      'project: mindlore',
      '---',
      '',
      '## User',
      '',
      'v0.6.2 spec yaz',
      '',
      '## Assistant',
      '',
      'Tamam, başlıyorum.',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toContain('v0.6.2 spec yaz');
  });

  it('detects decision keywords', () => {
    const transcript = [
      '---',
      'type: raw',
      '---',
      '',
      '## User',
      '',
      'karar: tek DB kullan',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toContain('karar');
  });

  it('detects english decision keywords', () => {
    const transcript = [
      '---',
      'type: raw',
      '---',
      '',
      '## User',
      '',
      'decision: use single DB',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toContain('decision');
  });

  it('rejects bare words without decision context', () => {
    const text = 'implementasyon planı yazacağız';
    const hasDecision = ALL_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
    expect(hasDecision).toBe(false);
  });

  it('includes last intent when different from first', () => {
    const transcript = [
      '---',
      'type: raw',
      '---',
      '',
      '## User',
      '',
      'brainstorming yap',
      '',
      '## Assistant',
      '',
      'Tamam.',
      '',
      '## User',
      '',
      'spec yaz',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toContain('brainstorming');
    expect(summary).toContain('spec yaz');
  });

  it('returns empty string for empty transcript', () => {
    const summary = extractSessionSummary('');
    expect(summary).toBe('');
  });

  it('handles transcript with no user messages', () => {
    const transcript = [
      '---',
      'type: raw',
      '---',
      '',
      '## Assistant',
      '',
      'Hello',
      '',
    ].join('\n');

    const summary = extractSessionSummary(transcript);
    expect(summary).toBe('');
  });
});
