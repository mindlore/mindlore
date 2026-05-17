#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import { CC_PLUGIN_CACHE_DIR, CACHE_STALE_AGE_MS } from './lib/constants.js';

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

export interface CleanCacheResult {
  cleaned: string[];
  skipped: Array<{ version: string; reason: string }>;
}

export function cleanCacheVersions(versions: string[]): CleanCacheResult {
  const cleaned: string[] = [];
  const skipped: Array<{ version: string; reason: string }> = [];
  for (const versionDir of versions) {
    try {
      fs.rmSync(versionDir, { recursive: true, force: true });
      cleaned.push(versionDir);
    } catch (err: any) {
      skipped.push({ version: versionDir, reason: err.code ?? 'UNKNOWN' });
    }
  }
  return { cleaned, skipped };
}

export async function cleanCacheVersion(rootDir: string, dryRun = false): Promise<{ cleaned: string[]; skipped: string[] }> {
  const cleaned: string[] = [];
  const skipped: string[] = [];
  const versions = fs.readdirSync(rootDir).filter(v => /^\d+\.\d+\.\d+/.test(v));
  versions.sort(compareSemver);
  const latest = versions[versions.length - 1];
  await Promise.all(versions.map(async (version) => {
    if (version === latest) return;
    const versionPath = path.join(rootDir, version);
    if (dryRun) {
      cleaned.push(version);
      return;
    }
    try {
      await fsp.rm(versionPath, { recursive: true, force: true });
      cleaned.push(version);
    } catch (err) {
      const e = err instanceof Error ? err : undefined;
      const code = e && 'code' in e && typeof e.code === 'string' ? e.code : undefined;
      if (code === 'EPERM' || code === 'EBUSY') {
        process.stderr.write(`[clean-cache] skipped ${version}: locked file (${code}). Close Claude Code and retry.\n`);
        skipped.push(version);
        return;
      }
      throw err;
    }
  }));
  return { cleaned, skipped };
}

async function main(): Promise<void> {
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
    const result = await cleanCacheVersion(mindloreVersionsDir, dryRun);
    removedVersions.push(...result.cleaned);
    if (result.skipped.length > 0) {
      process.stderr.write(`cleaned: ${result.cleaned.length} versions, skipped: ${result.skipped.length} (close CC and retry)\n`);
    }
  }

  const cutoff = Date.now() - CACHE_STALE_AGE_MS;
  await Promise.all(fs.readdirSync(cache).map(async (entry) => {
    if (!entry.startsWith('temp_npm_')) return;
    const p = path.join(cache, entry);
    let stat;
    try { stat = fs.statSync(p); } catch { return; }
    if (stat.mtimeMs > cutoff) return;
    console.log(`${dryRun ? 'WOULD REMOVE' : 'REMOVING'}: ${p}`);
    if (!dryRun) await fsp.rm(p, { recursive: true, force: true });
    removedTemp.push(entry);
  }));

  console.log(`Done. Removed ${removedVersions.length} stale versions, ${removedTemp.length} stale temp dirs.`);
}

if (require.main === module) main();
