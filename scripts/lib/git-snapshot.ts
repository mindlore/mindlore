import { execSync } from 'child_process';
import path from 'path';

export function createPreEvictionTag(
  baseDir: string,
  filePath: string,
  reason: string = 'decay-archive'
): string | null {
  try {
    const slug = path.basename(filePath, '.md');
    const date = new Date().toISOString().slice(0, 10);
    const tagName = `pre-evict/${slug}-${date}`;

    execSync(`git tag -a "${tagName}" -m "${reason}: ${slug}"`, {
      cwd: baseDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return tagName;
  } catch {
    return null;
  }
}

export function listPreEvictionTags(baseDir: string): string[] {
  try {
    const output = execSync('git tag -l "pre-evict/*"', {
      cwd: baseDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
