import path from 'path';
import os from 'os';
import { MINDLORE_DIR } from './constants.js';

export function resolveMindloreHome(): string {
  if (process.env.MINDLORE_HOME) {
    return path.resolve(process.env.MINDLORE_HOME);
  }
  return path.join(os.homedir(), MINDLORE_DIR);
}
