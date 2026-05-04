export interface ManifestValidationResult {
  valid: boolean;
  manifestVersion: number;
  errors: string[];
  warnings: string[];
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const KNOWN_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'FileChanged', 'PreToolUse', 'PostToolUse',
  'PreCompact', 'PostCompact', 'CwdChanged',
];

export function validateManifest(manifest: Record<string, unknown>): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mv = typeof manifest.manifestVersion === 'number' ? manifest.manifestVersion : 1;

  if (manifest.manifestVersion !== undefined && (typeof manifest.manifestVersion !== 'number' || ![1, 2].includes(mv))) {
    errors.push(`manifestVersion must be 1 or 2, got: ${manifest.manifestVersion}`);
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('description is required and must be a string');
  }

  if (mv >= 2) {
    if (manifest.version !== undefined) {
      if (typeof manifest.version !== 'string' || !SEMVER_RE.test(manifest.version)) {
        errors.push(`version must be valid SemVer (x.y.z), got: ${manifest.version}`);
      }
    }

    if (manifest.minCCVersion !== undefined) {
      if (typeof manifest.minCCVersion !== 'string' || !SEMVER_RE.test(manifest.minCCVersion)) {
        errors.push(`minCCVersion must be valid SemVer (x.y.z), got: ${manifest.minCCVersion}`);
      }
    }

    if (manifest.conflicts !== undefined) {
      if (!Array.isArray(manifest.conflicts) || !manifest.conflicts.every((c: unknown) => typeof c === 'string')) {
        errors.push('conflicts must be an array of strings');
      }
    }
  }

  // Validate skills array
  if (manifest.skills !== undefined) {
    if (!Array.isArray(manifest.skills)) {
      errors.push('skills must be an array');
    } else {
      for (let i = 0; i < manifest.skills.length; i++) {
        const s = manifest.skills[i] as Record<string, unknown>;
        if (!s.name || typeof s.name !== 'string') errors.push(`skills[${i}]: name is required`);
        if (!s.path || typeof s.path !== 'string') errors.push(`skills[${i}]: path is required`);
      }
    }
  }

  // Validate hooks array
  if (manifest.hooks !== undefined) {
    if (!Array.isArray(manifest.hooks)) {
      errors.push('hooks must be an array');
    } else {
      for (let i = 0; i < manifest.hooks.length; i++) {
        const h = manifest.hooks[i] as Record<string, unknown>;
        if (!h.event || typeof h.event !== 'string') errors.push(`hooks[${i}]: event is required`);
        if (!h.script || typeof h.script !== 'string') errors.push(`hooks[${i}]: script is required`);
        if (h.event && typeof h.event === 'string' && !KNOWN_EVENTS.includes(h.event)) {
          warnings.push(`hooks[${i}]: unknown event "${h.event}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, manifestVersion: mv, errors, warnings };
}
