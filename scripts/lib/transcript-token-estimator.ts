import * as fs from 'fs';

const CHAR_PER_TOKEN = 4;
const DEFAULT_TAIL_LINES = 500;
// Real CC JSONL lines carry heavy metadata (parentUuid, sessionId, gitBranch, etc.)
// in addition to message content. Empirical avg ≈ 1500 bytes/line. Underestimating
// this causes the tail read to cover fewer lines than DEFAULT_TAIL_LINES suggests.
const AVG_BYTES_PER_TRANSCRIPT_LINE = 1500;
const DEFAULT_CONTEXT_WINDOW = 200_000;

// Hook spawns fresh node per UserPromptSubmit, so this Map is effectively
// per-invocation in production. The cache only matters when the module is
// loaded long-running (jest workers, tests).
const cache = new Map<string, { mtime: number; tokens: number }>();

export interface EstimateOptions {
  tailLines?: number;
}

// Real CC transcript schema: { type, message: { content: string | ContentBlock[] }, ... }
// Test fixtures schema: { role, content: string }
// Handle both; fall through to JSON-stringify length for unknown shapes.
function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function countContentChars(obj: unknown): number {
  if (!isRecord(obj)) return 0;
  const candidates: unknown[] = [];
  if (isRecord(obj.message)) candidates.push(obj.message.content);
  candidates.push(obj.content);
  for (const content of candidates) {
    if (content === null || content === undefined) continue;
    if (typeof content === 'string') return content.length;
    if (Array.isArray(content)) {
      let sum = 0;
      for (const block of content) {
        if (typeof block === 'string') {
          sum += block.length;
        } else if (isRecord(block)) {
          if (typeof block.text === 'string') sum += block.text.length;
          else if (typeof block.content === 'string') sum += block.content.length;
          else sum += JSON.stringify(block).length;
        }
      }
      return sum;
    }
    return JSON.stringify(content).length;
  }
  return 0;
}

export function estimateContextTokens(
  transcriptPath: string,
  opts: EstimateOptions = {},
): number {
  const tail = opts.tailLines ?? DEFAULT_TAIL_LINES;
  let fd: number | undefined;
  try {
    const st = fs.statSync(transcriptPath);
    const cached = cache.get(transcriptPath);
    if (cached && cached.mtime === st.mtimeMs) return cached.tokens;

    const readSize = Math.min(st.size, tail * AVG_BYTES_PER_TRANSCRIPT_LINE);
    if (readSize === 0) {
      cache.set(transcriptPath, { mtime: st.mtimeMs, tokens: 0 });
      return 0;
    }
    fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.allocUnsafe(readSize);
    const bytesRead = fs.readSync(fd, buf, 0, readSize, st.size - readSize);
    const text = buf.toString('utf8', 0, bytesRead);

    let chars = 0;
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        chars += countContentChars(obj);
      } catch {
        // skip malformed line
      }
    }

    const tokens = Math.floor(chars / CHAR_PER_TOKEN);
    cache.set(transcriptPath, { mtime: st.mtimeMs, tokens });
    return tokens;
  } catch {
    return 0;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

export function getContextWindow(): number {
  const env = process.env.CLAUDE_CONTEXT_WINDOW;
  if (env) {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return DEFAULT_CONTEXT_WINDOW;
}

export function resultCountFromContext(pct: number): number {
  if (pct < 0.5) return 5;
  if (pct < 0.75) return 3;
  if (pct < 0.9) return 2;
  return 1;
}

export function adaptiveResultCount(transcriptPath: string | undefined): number {
  if (!transcriptPath) return 3;
  const tokens = estimateContextTokens(transcriptPath);
  if (tokens === 0) return 3;
  return resultCountFromContext(tokens / getContextWindow());
}
