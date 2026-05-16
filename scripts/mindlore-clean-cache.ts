#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { CC_PLUGIN_CACHE_DIR } from './lib/constants.js';

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

export function cleanCacheVersion(rootDir: string): { cleaned: string[]; skipped: string[] } {
  const cleaned: string[] = [];
  const skipped: string[] = [];
  const versions = fs.readdirSync(rootDir).filter(v => /^\d+\.\d+\.\d+/.test(v));
  versions.sort(compareSemver);
  const latest = versions[versions.length - 1];
  for (const version of versions) {
    if (version === latest) continue;
    const versionPath = path.join(rootDir, version);
    try {
      fs.rmSync(versionPath, { recursive: true, force: true });
      cleaned.push(version);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EBUSY') {
        process.stderr.write(`[clean-cache] skipped ${version}: locked file (${code}). Close Claude Code and retry.\n`);
        skipped.push(version);
        continue;
      }
      throw err;
    }
  }
  return { cleaned, skipped };
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const cache = CC_PLUGIN_CACHE_DIR;
  if (!fs.existsSync(cache)) {
    console.log('No CC plugin cache dir; nothing to clean.');
    return;
  }
  const mindloreVersionsDir = path.join(cache, 'mindlore', 'mindlore');
  const removedVersions: string[] = [];
  const removedTemp: string[] = [];

  if (fs.existsSync(mindloreVersionsDir)) {
    const result = cleanCacheVersion(mindloreVersionsDir);
    removedVersions.push(...result.cleaned);
    if (result.skipped.length > 0) {
      process.stderr.write(`cleaned: ${result.cleaned.length} versions, skipped: ${result.skipped.length} (close CC and retry)\n`);
    }
  }

  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const entry of fs.readdirSync(cache)) {
    if (!entry.startsWith('temp_npm_')) continue;
    const p = path.join(cache, entry);
    let stat;
    try { stat = fs.statSync(p); } catch { continue; }
    if (stat.mtimeMs > cutoff) continue;
    console.log(`${dryRun ? 'WOULD REMOVE' : 'REMOVING'}: ${p}`);
    if (!dryRun) fs.rmSync(p, { recursive: true, force: true });
    removedTemp.push(entry);
  }

  console.log(`Done. Removed ${removedVersions.length} stale versions, ${removedTemp.length} stale temp dirs.`);
}

if (require.main === module) main();
