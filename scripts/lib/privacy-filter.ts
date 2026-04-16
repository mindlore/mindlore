export const DEFAULT_PATTERNS: RegExp[] = [
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /ghp_[A-Za-z0-9]{36,}/g,
  /gho_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  /npm_[A-Za-z0-9]{36,}/g,
  /xox[bporas]-[A-Za-z0-9-]{10,}/g,
  /(?:postgres|mysql|mongodb|redis|amqp):\/\/[^\s"']+/g,
  /(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|DB_PASSWORD|AUTH_TOKEN|ACCESS_KEY|SECRET_KEY)=\S+/gi,
];

const REPLACEMENT = '[REDACTED]';

export function redactSecrets(text: string, extraPatterns?: RegExp[]): string {
  let result = text;
  const patterns = extraPatterns
    ? [...DEFAULT_PATTERNS, ...extraPatterns]
    : DEFAULT_PATTERNS;

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, REPLACEMENT);
  }
  return result;
}
