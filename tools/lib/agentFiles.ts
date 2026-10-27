// Mirror of agent/skills and agent/agents into the per-tool locations listed in agent/targets.json.
// `expectedFiles` computes what every generated file must contain; `diffs` compares with the disk;
// `syncAll` writes. The test suite fails if `diffs` is not empty.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export interface Targets { skills: string[]; agents: string[] }
export interface Diff { path: string; problem: 'missing' | 'differs' | 'stale' }

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function readTargets(root: string): Targets {
  return JSON.parse(readFileSync(join(root, 'agent', 'targets.json'), 'utf8')) as Targets;
}

/** relative-to-root path -> content, for every generated file. */
export function expectedFiles(root: string): Map<string, string> {
  const t = readTargets(root);
  const out = new Map<string, string>();
  const skillsSrc = join(root, 'agent', 'skills');
  for (const f of walk(skillsSrc)) {
    const rel = relative(skillsSrc, f);
    for (const target of t.skills) out.set(join(target, rel), readFileSync(f, 'utf8'));
  }
  const agentsSrc = join(root, 'agent', 'agents');
  for (const f of walk(agentsSrc)) {
    const rel = relative(agentsSrc, f);
    for (const target of t.agents) out.set(join(target, rel), readFileSync(f, 'utf8'));
  }
  return out;
}

/** Names of the skill dirs / agent files that agent/ owns, per target dir. */
function ownedNames(root: string): { skills: string[]; agents: string[] } {
  const s = join(root, 'agent', 'skills');
  const a = join(root, 'agent', 'agents');
  return {
    skills: existsSync(s) ? readdirSync(s).filter((n) => statSync(join(s, n)).isDirectory()) : [],
    agents: existsSync(a) ? readdirSync(a).filter((n) => statSync(join(a, n)).isFile()) : [],
  };
}

export function diffs(root: string): Diff[] {
  const exp = expectedFiles(root);
  const t = readTargets(root);
  const own = ownedNames(root);
  const out: Diff[] = [];
  for (const [rel, content] of exp) {
    const abs = join(root, rel);
    if (!existsSync(abs)) out.push({ path: rel, problem: 'missing' });
    else if (readFileSync(abs, 'utf8') !== content) out.push({ path: rel, problem: 'differs' });
  }
  // files inside a generated skill dir that no longer exist in the source
  for (const target of t.skills) {
    for (const name of own.skills) for (const f of walk(join(root, target, name))) {
      const rel = relative(root, f);
      if (!exp.has(rel)) out.push({ path: rel, problem: 'stale' });
    }
  }
  return out;
}

export function syncAll(root: string): { written: string[]; removed: string[] } {
  const exp = expectedFiles(root);
  const written: string[] = [];
  const removed: string[] = [];
  for (const d of diffs(root)) {
    if (d.problem === 'stale') { rmSync(join(root, d.path), { force: true }); removed.push(d.path); }
  }
  for (const [rel, content] of exp) {
    const abs = join(root, rel);
    if (existsSync(abs) && readFileSync(abs, 'utf8') === content) continue;
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
    written.push(rel);
  }
  return { written, removed };
}
