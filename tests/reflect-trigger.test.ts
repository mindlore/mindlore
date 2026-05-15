const { shouldNudgeReflect } = require('../hooks/lib/reflect-trigger.cjs');

const now = new Date('2026-05-15T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000).toISOString();

test('returns true when both lastReflect and lastNudge are null', () => {
  expect(shouldNudgeReflect(null, null, now)).toBe(true);
});

test('returns true when lastReflect 8 days ago and no nudge yet', () => {
  expect(shouldNudgeReflect(daysAgo(8), null, now)).toBe(true);
});

test('returns false when lastReflect 8 days ago but nudge was 2h ago (cooldown)', () => {
  expect(shouldNudgeReflect(daysAgo(8), hoursAgo(2), now)).toBe(false);
});

test('returns true when lastReflect 8 days ago and nudge was 25h ago (cooldown expired)', () => {
  expect(shouldNudgeReflect(daysAgo(8), hoursAgo(25), now)).toBe(true);
});

test('returns false when lastReflect 5 days ago (threshold not met)', () => {
  expect(shouldNudgeReflect(daysAgo(5), null, now)).toBe(false);
});

test('returns true exactly at 7 days reflect threshold', () => {
  expect(shouldNudgeReflect(daysAgo(7), null, now)).toBe(true);
});

test('returns false for invalid reflect date string', () => {
  expect(shouldNudgeReflect('not-a-date', null, now)).toBe(false);
});

test('handles invalid nudge date gracefully (ignored, falls through to reflect check)', () => {
  expect(shouldNudgeReflect(daysAgo(8), 'invalid', now)).toBe(true);
});
