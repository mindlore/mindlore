import * as path from 'path';
import * as fs from 'fs';

export interface FileExtraction {
  file_path: string;
  language: string;
  last_modified: string;
  summary: string;
}

const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.go': 'go', '.rs': 'rust',
  '.md': 'markdown', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.sh': 'shell', '.bash': 'shell',
};

export function extractFile(filePath: string, content: string): FileExtraction {
  const ext = path.extname(filePath).toLowerCase();
  const language = LANG_MAP[ext] ?? 'text';
  let mtime = new Date().toISOString();
  try {
    if (fs.existsSync(filePath)) {
      mtime = fs.statSync(filePath).mtime.toISOString();
    }
  } catch {}
  return {
    file_path: filePath,
    language,
    last_modified: mtime,
    summary: content.slice(0, 500).trim(),
  };
}
