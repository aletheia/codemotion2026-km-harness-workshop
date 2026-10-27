// npm run verify-tags [-- --source <path|url>] [--only seg1-start,seg2-done] [--keep]
// For every tag (segN-start, segN-done, workshop-v1): clone into a fresh temp dir, check the tag out
// (detached), then run `npm ci`, `npm run doctor`, `npm run typecheck`, `npm test`. Stops at the first
// failure with exit 2 and a one-line message.
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeTempDir, removeTree } from '../src/adapters/files';
import { repoRoot } from '../src/adapters/paths';
import { Rejection } from '../src/app/errors';
import { emit, flag, parseArgs, run } from './lib/cli';
import { git } from './lib/git';

const args = parseArgs(process.argv.slice(2), ['text', 'keep']);

function step(cwd: string, label: string, cmd: string, cmdArgs: string[]): { label: string; ms: number } {
  const t0 = Date.now();
  const env = { ...process.env };
  for (const k of ['HARNESS_EVENTS_DIR', 'HARNESS_PROJECTIONS_DIR', 'HARNESS_STATE_DIR']) delete env[k];
  const r = spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8', env });
  if (r.status !== 0) {
    const tail = `${r.stderr}${r.stdout}`.trim().split('\n').filter(Boolean).slice(-1)[0] ?? '(no output)';
    throw new Rejection(`${label} failed (exit ${r.status}): ${tail}`);
  }
  return { label, ms: Date.now() - t0 };
}

void run(() => {
  const rawSource = flag(args, 'source') ?? repoRoot;
  const source = /^[a-z]+:\/\//.test(rawSource) ? rawSource : resolve(rawSource);
  const tagList = git(source, 'tag', '-l', 'seg*-start', 'seg*-done', 'workshop-v1').split('\n').filter(Boolean);
  const order = (t: string): number => (t === 'workshop-v1' ? 99 : Number(/seg(\d)/.exec(t)![1]) * 2 + (t.endsWith('-done') ? 1 : 0));
  tagList.sort((a, b) => order(a) - order(b));
  const only = flag(args, 'only')?.split(',');
  const tags = only ? tagList.filter((t) => only.includes(t)) : tagList;
  if (!tags.length) throw new Rejection('no tags to verify (run: npm run tags)');
  const results: { tag: string; sha: string; steps: { label: string; ms: number }[] }[] = [];
  for (const tag of tags) {
    const dir = makeTempDir(`verify-${tag}-`);
    try {
      git(tmpdir(), 'clone', '--quiet', source, dir);
      git(dir, '-c', 'advice.detachedHead=false', 'checkout', '--quiet', tag);
      const sha = git(dir, 'rev-parse', 'HEAD');
      const steps = [
        step(dir, `${tag}: npm ci`, 'npm', ['ci', '--no-audit', '--no-fund']),
        step(dir, `${tag}: doctor`, 'npm', ['run', '--silent', 'doctor']),
        step(dir, `${tag}: typecheck`, 'npm', ['run', '--silent', 'typecheck']),
        step(dir, `${tag}: test`, 'npm', ['test', '--silent']),
      ];
      results.push({ tag, sha, steps });
    } finally {
      if (!args.flags.keep) removeTree(dir);
    }
  }
  emit('verify-tags', { source, verified: results }, results.map((r) => `ok ${r.tag.padEnd(12)} ${r.sha.slice(0, 7)}  ${r.steps.map((s) => `${s.label.split(': ')[1]} ${s.ms}ms`).join(', ')}`).join('\n'), args);
});
