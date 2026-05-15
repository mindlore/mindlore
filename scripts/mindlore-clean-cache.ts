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
    const versions = fs.readdirSync(mindloreVersionsDir).filter(v => /^\d+\.\d+\.\d+/.test(v));
    versions.sort(compareSemver);
    const latest = versions[versions.length - 1];
    for (const v of versions) {
      if (v === latest) continue;
      const d = path.join(mindloreVersionsDir, v);
      console.log(`${dryRun ? 'WOULD REMOVE' : 'REMOVING'}: ${d}`);
      if (!dryRun) fs.rmSync(d, { recursive: true, force: true });
      removedVersions.push(v);
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

main();
