export interface ReadGuardInput {
  filePath: string;
  basename: string;
  tokens?: number;
}

export interface ReadGuardDecision {
  block?: boolean;
  warning?: string;
  additionalContext?: string;
  updatedReadsEntry: { count: number; tokens: number; chars: number };
}

export function runReadGuard(
  input: ReadGuardInput,
  existingReads: Record<string, { count?: number; tokens?: number; chars?: number } | number>
): ReadGuardDecision {
  const normalizedPath = input.filePath;
  const existing = existingReads[normalizedPath];

  let count: number;
  let tokens: number;
  if (typeof existing === 'number') {
    count = existing + 1;
    tokens = 0;
  } else if (existing && typeof existing === 'object') {
    count = (existing.count || 0) + 1;
    tokens = existing.tokens || 0;
  } else {
    count = 1;
    tokens = 0;
  }

  const updatedReadsEntry = { count, tokens, chars: 0 };
  existingReads[normalizedPath] = updatedReadsEntry;

  if (count >= 3) {
    const totalWaste = tokens > 0 ? ` Toplam israf: ~${tokens * (count - 1)} token.` : '';
    return {
      block: true,
      warning: `[Mindlore BLOCK] ${input.basename} bu session'da ${count}. kez okunuyor.${totalWaste} Edit icin gerekiyorsa once degisikligini yap, sonra tekrar oku. Analiz icin ctx_execute_file kullan.`,
      updatedReadsEntry,
    };
  }

  if (count > 1) {
    const totalWaste = tokens > 0 ? ` Toplam tekrar: ~${tokens * (count - 1)} token.` : '';
    return {
      additionalContext: `[Mindlore: ${input.basename} bu session'da ${count}. kez okunuyor.${totalWaste} Bir sonraki okuma engellenecek — Edit gerekiyorsa simdi yap.]`,
      updatedReadsEntry,
    };
  }

  return { updatedReadsEntry };
}
