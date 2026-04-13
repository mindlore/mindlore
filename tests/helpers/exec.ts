/**
 * Extract stdout from execSync error (unknown type).
 * Used in test catch blocks where execSync throws with stdout/stderr.
 */
export function getExecStdout(err: unknown): string {
  if (err !== null && typeof err === 'object' && 'stdout' in err) {
    return typeof err.stdout === 'string' ? err.stdout : '';
  }
  return '';
}

export function getExecResult(err: unknown): { stdout: string; stderr: string; exitCode: number } {
  if (err !== null && typeof err === 'object') {
    const stdout = 'stdout' in err && typeof err.stdout === 'string' ? err.stdout : '';
    const stderr = 'stderr' in err && typeof err.stderr === 'string' ? err.stderr : '';
    const status = 'status' in err && typeof err.status === 'number' ? err.status : 0;
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: status };
  }
  return { stdout: '', stderr: '', exitCode: 0 };
}
