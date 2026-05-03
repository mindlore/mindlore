import { execSync } from 'child_process';

export default function globalSetup(): void {
  execSync('npm run build', { stdio: 'inherit' });
}
