// Thin git adapter (argument arrays, no shell).
import { execFileSync } from 'node:child_process';

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024 }).trim();
}

export function tryGit(cwd: string, ...args: string[]): string | undefined {
  try { return git(cwd, ...args); } catch { return undefined; }
}
