export function mergeDefaults(target: Record<string, unknown>, defaults: Record<string, unknown>): { result: Record<string, unknown>; changed: boolean } {
  const result = { ...target };
  let changed = false;
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (!(key in result) || result[key] === undefined || result[key] === null) {
      result[key] = defaultValue;
      changed = true;
    } else if (
      typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key]) &&
      typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)
    ) {
      /* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- narrowed by typeof+null+array checks above */
      const nested = mergeDefaults(
        result[key] as Record<string, unknown>,
        defaultValue as Record<string, unknown>,
      );
      /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
      if (nested.changed) {
        result[key] = nested.result;
        changed = true;
      }
    }
  }
  return { result, changed };
}
