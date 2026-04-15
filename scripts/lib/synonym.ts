export type SynonymMap = Record<string, string[]>;

export function loadSynonyms(config: Record<string, unknown>): SynonymMap {
  if (!config || typeof config.synonyms !== 'object' || config.synonyms === null) {
    return {};
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- runtime-validated object shape
  return config.synonyms as SynonymMap;
}

export function expandQuery(query: string, synonyms: SynonymMap): string[] {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const expanded: string[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const lower = term.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      expanded.push(term);
    }

    const syns = synonyms[lower];
    if (syns) {
      for (const syn of syns) {
        const synLower = syn.toLowerCase();
        if (!seen.has(synLower)) {
          seen.add(synLower);
          expanded.push(syn);
        }
      }
    }
  }

  return expanded;
}
