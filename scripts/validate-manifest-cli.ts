import fs from 'fs';
import path from 'path';
import { validateManifest } from './lib/validate-manifest.js';

const manifestPath = path.resolve(__dirname, '..', '..', 'plugin.json');

let manifest: Record<string, unknown>;
try {
  const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error('plugin.json must be a JSON object');
    process.exit(1);
  }
  manifest = { ...parsed };
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Failed to read/parse plugin.json: ${msg}`);
  process.exit(1);
}

const result = validateManifest(manifest);

if (result.valid) {
  console.log(`Manifest v${result.manifestVersion} valid`);
  if (result.warnings.length > 0) {
    for (const w of result.warnings) console.log(`  WARN: ${w}`);
  }
} else {
  console.error('Manifest validation failed:');
  for (const e of result.errors) console.error(`  ERROR: ${e}`);
  process.exit(1);
}
