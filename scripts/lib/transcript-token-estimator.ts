import * as fs from 'fs';

const CHAR_PER_TOKEN = 4;
const DEFAULT_TAIL_LINES = 500;
const DEFAULT_CONTEXT_WINDOW = 200_000;

const cache = new Map<string, { mtime: number; tokens: number }>();

export interface EstimateOptions {
  tailLines?: number;
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

    const readSize = Math.min(st.size, tail * 500);
    if (readSize === 0) {
      cache.set(transcriptPath, { mtime: st.mtimeMs, tokens: 0 });
      return 0;
    }
    fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, st.size - readSize);
    const text = buf.toString('utf8');

    let chars = 0;
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        const content = obj?.content;
        if (typeof content === 'string') {
          chars += content.length;
        } else if (content !== null && content !== undefined) {
          chars += JSON.stringify(content).length;
        }
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
