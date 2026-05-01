const REPLACEMENT = '[REDACTED]';

const PATTERN_PREFIXES: Array<{ prefix: string; pattern: RegExp }> = [
  { prefix: 'sk-', pattern: /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g },
  { prefix: 'AKIA', pattern: /AKIA[0-9A-Z]{16}/g },
  { prefix: 'ghp_', pattern: /ghp_[A-Za-z0-9]{36,}/g },
  { prefix: 'gho_', pattern: /gho_[A-Za-z0-9]{36,}/g },
  { prefix: 'github_pat_', pattern: /github_pat_[A-Za-z0-9_]{22,}/g },
  { prefix: 'npm_', pattern: /npm_[A-Za-z0-9]{36,}/g },
  { prefix: 'xox', pattern: /xox[bporas]-[A-Za-z0-9-]{10,}/g },
  { prefix: 'eyJ', pattern: /eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}/g },
  { prefix: 'AIza', pattern: /AIza[0-9A-Za-z_\-]{30,}/g },
  { prefix: 'sk_live_', pattern: /sk_live_[a-zA-Z0-9]{20,}/g },
  { prefix: 'pk_live_', pattern: /pk_live_[a-zA-Z0-9]{20,}/g },
  { prefix: 'Bearer', pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g },
  { prefix: '-----BEGIN', pattern: /-----BEGIN\s(?:RSA\s|EC\s|DSA\s|OPENSSH\s)?PRIVATE\sKEY-----/g },
  { prefix: 'Basic', pattern: /Basic\s+[a-zA-Z0-9+\/]{16,}={0,2}/g },
  { prefix: '-----BEGIN CERTIFICATE', pattern: /-----BEGIN\sCERTIFICATE-----/g },
];

const NO_PREFIX_PATTERNS: RegExp[] = [
  /(?:postgres|mysql|mongodb|redis|amqp)(?:\+srv)?:\/\/[^\s"']+/g,
  /(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|DB_PASSWORD|AUTH_TOKEN|ACCESS_KEY|SECRET_KEY)=\S+/gi,
  /(?:api_key|auth_token|access_token|refresh_token|client_secret|private_key|secret_key)\s*[:=]\s*["']?[^\s"',}{]{8,}["']?/gi,
];

export const DEFAULT_PATTERNS: RegExp[] = [
  ...PATTERN_PREFIXES.map(p => p.pattern),
  ...NO_PREFIX_PATTERNS,
];

export function redactSecrets(text: string, extraPatterns?: RegExp[]): string {
  let result = text;

  for (const { prefix, pattern } of PATTERN_PREFIXES) {
    if (result.includes(prefix)) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, REPLACEMENT);
    }
  }

  const remaining = extraPatterns
    ? [...NO_PREFIX_PATTERNS, ...extraPatterns]
    : NO_PREFIX_PATTERNS;

  for (const pattern of remaining) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, REPLACEMENT);
  }

  return result;
}
