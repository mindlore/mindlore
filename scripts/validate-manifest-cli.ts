import fs from 'fs';
import path from 'path';
import { validateManifest } from './lib/validate-manifest.js';

const manifestPath = path.resolve(__dirname, '..', '..', 'plugin.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
