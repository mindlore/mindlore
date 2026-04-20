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
    let tagName = `pre-evict/${slug}-${date}`;

    // Collision check: append suffix if tag already exists
    try {
      const existing = execSync('git tag -l "pre-evict/*"', { cwd: baseDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (existing.split('\n').includes(tagName)) {
        for (let i = 2; i <= 10; i++) {
          const candidate = `${tagName}-${i}`;
          if (!existing.split('\n').includes(candidate)) {
            tagName = candidate;
            break;
          }
        }
      }
    } catch { /* git tag -l failed, proceed with original name */ }

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
