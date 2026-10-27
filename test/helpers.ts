import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const root = resolve(__dirname, '..');
const tsx = join(root, 'node_modules', '.bin', 'tsx');

export interface Sandbox { dir: string; env: NodeJS.ProcessEnv; eventsFile: string; lines(): string[] }

export function sandbox(): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), 'harness-test-'));
  for (const d of ['events', 'projections', 'state']) mkdirSync(join(dir, d));
  const env = { ...process.env, HARNESS_EVENTS_DIR: join(dir, 'events'), HARNESS_PROJECTIONS_DIR: join(dir, 'projections'), HARNESS_STATE_DIR: join(dir, 'state') };
  const eventsFile = join(dir, 'events', 'events.jsonl');
  return { dir, env, eventsFile, lines: () => (existsSync(eventsFile) ? readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean) : []) };
}

export interface Run { status: number; stdout: string; stderr: string; json: Record<string, unknown> | null }

/** Runs `tsx tools/<tool>.ts ...args` exactly as the npm script does. */
export function tool(sb: Sandbox, name: string, ...args: string[]): Run {
  const r = spawnSync(tsx, [join(root, 'tools', `${name}.ts`), ...args], { cwd: root, env: sb.env, encoding: 'utf8' });
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(r.stdout) as Record<string, unknown>; } catch { /* not json */ }
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr, json };
}

export function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
export const read = (p: string): string => readFileSync(p, 'utf8');
