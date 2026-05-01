import path from 'path';

const PRIVATE_IP_RE = /^(?:127\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|fc00:|fe80:|::1$|localhost$)/i;

const SHELL_UNSAFE = /[;|&`$(){}[\]!#~<>\\'"*?\n\r]/;

export function validatePath(targetPath: string, allowedBase: string): void {
  const resolved = path.resolve(targetPath);
  const base = path.resolve(allowedBase);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`Path must be under ${allowedBase}, got: ${targetPath}`);
  }
}

export function validateUrl(urlOrString: string | URL): void {
  let hostname: string;
  try {
    const u = typeof urlOrString === 'string' ? new URL(urlOrString) : urlOrString;
    hostname = u.hostname.replace(/^\[|]$/g, '');
  } catch {
    throw new Error(`Invalid URL: ${String(urlOrString)}`);
  }
  if (PRIVATE_IP_RE.test(hostname)) {
    throw new Error(`Private/reserved IP range not allowed: ${hostname}`);
  }
}

export function sanitizeForExecFile(value: string): string {
  if (SHELL_UNSAFE.test(value)) {
    throw new Error('Invalid characters in argument');
  }
  return value;
}

export function escapeYamlValue(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}
