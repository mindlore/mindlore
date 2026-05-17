const TAIL_BYTES = 2_000_000;
const CHAR_PER_TOKEN = 4;

function countTokens(text: string): number {
  return Math.floor(text.length / CHAR_PER_TOKEN);
}

export function estimateTokens(transcriptPath: string): number {
  const fs = require('fs');
  const fileSize = fs.statSync(transcriptPath).size;
  const readSize = Math.min(fileSize, TAIL_BYTES);
  if (readSize === 0) return 0;

  const fd = fs.openSync(transcriptPath, 'r');
  const buf = Buffer.allocUnsafe(readSize);
  const bytesRead = fs.readSync(fd, buf, 0, readSize, fileSize - readSize);
  fs.closeSync(fd);

  const text = buf.toString('utf8', 0, bytesRead);
  const tailTokens = countTokens(text);

  if (fileSize > TAIL_BYTES) {
    // Mode A: extrapolate to full file
    return Math.round((fileSize / TAIL_BYTES) * tailTokens);
  }
  return tailTokens;
}
