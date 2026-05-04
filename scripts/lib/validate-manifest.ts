import { isKnownHookEvent } from './constants.js';

export interface ManifestValidationResult {
  valid: boolean;
  manifestVersion: number;
  errors: string[];
  warnings: string[];
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function validateSemVer(value: unknown, label: string, errors: string[]): void {
  if (value !== undefined) {
    if (typeof value !== 'string' || !SEMVER_RE.test(value)) {
      errors.push(`${label} must be valid SemVer (x.y.z), got: ${value}`);
    }
  }
}

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
    validateSemVer(manifest.version, 'version', errors);
    validateSemVer(manifest.minCCVersion, 'minCCVersion', errors);

    if (manifest.conflicts !== undefined) {
      if (!Array.isArray(manifest.conflicts) || !manifest.conflicts.every((c: unknown) => typeof c === 'string')) {
        errors.push('conflicts must be an array of strings');
      }
    }
  }
  if (manifest.skills !== undefined) {
    if (!Array.isArray(manifest.skills)) {
      errors.push('skills must be an array');
    } else {
      for (let i = 0; i < manifest.skills.length; i++) {
        const s = manifest.skills[i];
        if (!s || typeof s !== 'object' || Array.isArray(s)) {
          errors.push(`skills[${i}]: must be an object`);
          continue;
        }
        const name = 'name' in s ? s.name : undefined;
        const path = 'path' in s ? s.path : undefined;
        if (!name || typeof name !== 'string') errors.push(`skills[${i}]: name is required`);
        if (!path || typeof path !== 'string') errors.push(`skills[${i}]: path is required`);
      }
    }
  }

  if (manifest.hooks !== undefined) {
    if (!Array.isArray(manifest.hooks)) {
      errors.push('hooks must be an array');
    } else {
      for (let i = 0; i < manifest.hooks.length; i++) {
        const h = manifest.hooks[i];
        if (!h || typeof h !== 'object' || Array.isArray(h)) {
          errors.push(`hooks[${i}]: must be an object`);
          continue;
        }
        const event = 'event' in h ? h.event : undefined;
        const script = 'script' in h ? h.script : undefined;
        if (!event || typeof event !== 'string') errors.push(`hooks[${i}]: event is required`);
        if (!script || typeof script !== 'string') errors.push(`hooks[${i}]: script is required`);
        if (event && typeof event === 'string' && !isKnownHookEvent(event)) {
          warnings.push(`hooks[${i}]: unknown event "${event}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, manifestVersion: mv, errors, warnings };
}
