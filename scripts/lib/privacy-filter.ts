export const DEFAULT_PATTERNS: RegExp[] = [
  // Anthropic / OpenAI (covers sk-proj-, sk-ant-, and plain sk-)
  /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g,
  // AWS
  /AKIA[0-9A-Z]{16}/g,
  // GitHub
  /ghp_[A-Za-z0-9]{36,}/g,
  /gho_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  // npm
  /npm_[A-Za-z0-9]{36,}/g,
  // Slack
  /xox[bporas]-[A-Za-z0-9-]{10,}/g,
  // JWT
  /eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}/g,
  // Google
  /AIza[0-9A-Za-z_\-]{30,}/g,
  // Stripe
  /sk_live_[a-zA-Z0-9]{20,}/g,
  /pk_live_[a-zA-Z0-9]{20,}/g,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g,
  // Private keys
  /-----BEGIN\s(?:RSA\s|EC\s|DSA\s|OPENSSH\s)?PRIVATE\sKEY-----/g,
  // Connection strings
  /(?:postgres|mysql|mongodb|redis|amqp)(?:\+srv)?:\/\/[^\s"']+/g,
  // Env-style secrets
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
