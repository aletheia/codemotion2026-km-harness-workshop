// Guarded file writes for everything that is NOT the event log. Refuses the events directory:
// the only way to change events/ is eventLog.append (and resetLog for the demo reset).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { eventsDir } from './paths';

export class ForbiddenWriteError extends Error {}

function guard(path: string): string {
  const abs = resolve(path);
  const ev = eventsDir();
  if (abs === ev || abs.startsWith(ev + sep)) throw new ForbiddenWriteError(`refusing to write inside the event log directory: ${abs}`);
  return abs;
}

export function writeTextFile(path: string, content: string): void {
  const abs = guard(path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

export function removeFile(path: string): void {
  rmSync(guard(path), { force: true });
}

/** Scratch directory under the OS temp dir (dry-run, tag verification). */
export function makeTempDir(prefix: string): string {
  return mkdtempSync(`${tmpdir()}${sep}${prefix}`);
}

/** Recursive delete of a scratch directory. Refuses anything that is, or contains, the events directory. */
export function removeTree(path: string): void {
  const abs = resolve(path);
  const ev = eventsDir();
  if (abs === ev || abs.startsWith(ev + sep) || ev.startsWith(abs + sep)) throw new ForbiddenWriteError(`refusing to delete ${abs}: it holds the event log`);
  rmSync(abs, { recursive: true, force: true });
}
