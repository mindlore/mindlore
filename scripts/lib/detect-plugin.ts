import fs from 'fs';
import path from 'path';
import { CC_PLUGIN_CACHE_DIR } from './constants.js';

export function detectPluginInstalled(): boolean {
  const pluginCacheDir = path.join(CC_PLUGIN_CACHE_DIR, 'mindlore');
  return fs.existsSync(pluginCacheDir);
}
