export interface Chunk {
  index: number;
  heading: string | null;
  breadcrumb: string;
  content: string;
  charCount: number;
}

export interface ChunkerOptions {
  maxChunkChars?: number;
}

export function chunkMarkdown(markdown: string, options: ChunkerOptions = {}): Chunk[] {
  const maxChunkChars = options.maxChunkChars ?? 10000;
  const lines = markdown.split('\n');
  const chunks: Chunk[] = [];
  let currentLines: string[] = [];
  let currentHeading: string | null = null;
  const headingStack: string[] = [];
  let inCodeBlock = false;

  function flush(): void {
    const content = currentLines.join('\n').trim();
    if (content.length === 0) return;
    const breadcrumb = headingStack.length > 0 ? headingStack.join(' > ') : '';
    const chunk: Chunk = {
      index: chunks.length,
      heading: currentHeading,
      breadcrumb,
      content,
      charCount: content.length,
    };

    if (chunk.charCount > maxChunkChars) {
      for (const c of splitOversized(chunk, maxChunkChars)) chunks.push(c);
    } else {
      chunks.push(chunk);
    }
    currentLines = [];
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentLines.push(line);
      continue;
    }

    if (inCodeBlock) {
      currentLines.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flush();
      currentHeading = line;
      const level = headingMatch[1]!.length;
      while (headingStack.length > 0) {
        const top = headingStack[headingStack.length - 1]!;
        const topLevel = (top.match(/^#+/) ?? [''])[0]!.length;
        if (topLevel >= level) headingStack.pop();
        else break;
      }
      headingStack.push(line);
    }

    currentLines.push(line);
  }

  flush();
  return chunks.map((c, i) => ({ ...c, index: i }));
}

function splitOversized(chunk: Chunk, maxChars: number): Chunk[] {
  const lines = chunk.content.split('\n');
  const result: Chunk[] = [];
  let buffer: string[] = [];
  let bufLen = 0;

  for (const line of lines) {
    if (bufLen + line.length > maxChars && buffer.length > 0) {
      result.push({
        index: chunk.index + result.length,
        heading: result.length === 0 ? chunk.heading : null,
        breadcrumb: chunk.breadcrumb,
        content: buffer.join('\n'),
        charCount: bufLen,
      });
      buffer = [];
      bufLen = 0;
    }
    buffer.push(line);
    bufLen += line.length + 1;
  }

  if (buffer.length > 0) {
    result.push({
      index: chunk.index + result.length,
      heading: result.length === 0 ? chunk.heading : null,
      breadcrumb: chunk.breadcrumb,
      content: buffer.join('\n'),
      charCount: bufLen,
    });
  }

  return result;
}
