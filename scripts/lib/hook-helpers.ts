import type { HookEntry } from './constants.js';

export function unwrapHookEntries(entry: HookEntry): Array<{ type?: string; command?: string }> {
  return entry.hooks && Array.isArray(entry.hooks) ? entry.hooks : [entry];
}

export function isMindloreHook(entry: HookEntry): boolean {
  return unwrapHookEntries(entry).some((h) => (h.command ?? '').includes('mindlore-'));
}

function isHookEntry(raw: unknown): raw is HookEntry {
  return typeof raw === 'object' && raw !== null;
}

export function countMindloreHooks(allHooks: Record<string, unknown[]>): number {
  let total = 0;
  for (const entries of Object.values(allHooks)) {
    for (const raw of entries ?? []) {
      if (!isHookEntry(raw)) continue;
      total += unwrapHookEntries(raw).filter((h) => (h.command ?? '').includes('mindlore-')).length;
    }
  }
  return total;
}
