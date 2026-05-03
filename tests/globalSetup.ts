import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function needsBuild(): boolean {
  const distDir = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) return true;
  const distMtime = fs.statSync(distDir).mtimeMs;
  const srcDir = path.resolve(__dirname, '..', 'scripts');
  const tsconfig = path.resolve(__dirname, '..', 'tsconfig.json');
  if (fs.existsSync(tsconfig) && fs.statSync(tsconfig).mtimeMs > distMtime) return true;
  if (!fs.existsSync(srcDir)) return true;
  const files = fs.readdirSync(srcDir, { recursive: true });
  for (const f of files) {
    if (String(f).endsWith('.ts')) {
      const fPath = path.join(srcDir, String(f));
      if (fs.statSync(fPath).mtimeMs > distMtime) return true;
    }
  }
  return false;
}

export default function globalSetup(): void {
  if (needsBuild()) {
    execSync('npm run build', { stdio: 'inherit' });
  }
}
