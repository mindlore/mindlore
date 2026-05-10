import fs from 'fs';
import path from 'path';
import { homedir } from './constants.js';

export function detectPluginInstalled(): boolean {
  const pluginCacheDir = path.join(homedir(), '.claude', 'plugins', 'cache', 'mindlore');
  return fs.existsSync(pluginCacheDir);
}
