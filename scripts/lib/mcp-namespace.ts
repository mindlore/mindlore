import path from 'path';
import fs from 'fs';
import os from 'os';
import { MINDLORE_DIR } from './constants.js';

export function resolveMindloreHome(): string {
  if (process.env.MINDLORE_HOME) {
    return path.resolve(process.env.MINDLORE_HOME);
  }
  const cwdLocal = path.join(process.cwd(), MINDLORE_DIR);
  if (fs.existsSync(cwdLocal)) {
    return cwdLocal;
  }
  return path.join(os.homedir(), MINDLORE_DIR);
}
